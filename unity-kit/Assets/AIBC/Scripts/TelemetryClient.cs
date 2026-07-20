// AI.B.C — pilot analytics, IDENTICAL event schema to the web build, so the
// same server dashboard (/dashboard) shows web + Unity players side by side.
// Anonymous device id only — never a child's name. Events queue in PlayerPrefs
// and flush whenever the backend is reachable; offline play loses nothing.
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace AIBC {
  public class TelemetryClient : MonoBehaviour {
    public static TelemetryClient I;
    public string baseUrl = "https://learning-city-api.onrender.com";
    public string classCode = "";
    public int grade = 4;

    string device;
    readonly List<string> queue = new List<string>();   // pre-serialized event JSON
    bool backendOk;

    void Awake() {
      I = this;
      device = PlayerPrefs.GetString("aibc_dev_id", "");
      if (device == "") {
        device = "u_" + System.Guid.NewGuid().ToString("N").Substring(0, 10);
        PlayerPrefs.SetString("aibc_dev_id", device);
      }
      LoadQueue();
      Track("boot", null);
      StartCoroutine(Heartbeat());
      StartCoroutine(FlushLoop());
    }

    static string Esc(string s) {
      return s == null ? "" : s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", " ");
    }

    /* extra: alternating key,value pairs; numbers pass raw via numeric detection */
    public static void Track(string ev, params object[] extra) {
      if (I == null) return;
      var sb = new StringBuilder();
      long ms = System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
      sb.Append("{\"t\":").Append(ms).Append(",\"e\":\"").Append(Esc(ev)).Append("\"");
      if (extra != null) {
        for (int i = 0; i + 1 < extra.Length; i += 2) {
          sb.Append(",\"").Append(Esc(extra[i].ToString())).Append("\":");
          object v = extra[i + 1];
          if (v is bool) sb.Append(((bool)v) ? "true" : "false");
          else if (v is int || v is long || v is float || v is double)
            sb.Append(System.Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture));
          else sb.Append("\"").Append(Esc(v.ToString())).Append("\"");
        }
      }
      sb.Append("}");
      I.queue.Add(sb.ToString());
      if (I.queue.Count > 800) I.queue.RemoveAt(0);
      I.SaveQueue();
    }

    IEnumerator Heartbeat() {
      var wait = new WaitForSecondsRealtime(60f);
      while (true) { yield return wait; if (Application.isFocused) Track("ping", null); }
    }

    IEnumerator FlushLoop() {
      var wait = new WaitForSecondsRealtime(45f);
      while (true) {
        yield return wait;
        if (queue.Count == 0) continue;
        if (!backendOk) {
          using (var h = UnityWebRequest.Get(baseUrl + "/health")) {
            h.timeout = 8; yield return h.SendWebRequest();
            backendOk = h.result == UnityWebRequest.Result.Success;
          }
          if (!backendOk) continue;
        }
        int n = Mathf.Min(queue.Count, 400);
        var payload = new StringBuilder();
        payload.Append("{\"device\":\"").Append(device).Append("\",\"cls\":\"").Append(Esc(classCode))
               .Append("\",\"grade\":\"").Append(grade).Append("\",\"events\":[");
        for (int i = 0; i < n; i++) { if (i > 0) payload.Append(","); payload.Append(queue[i]); }
        payload.Append("]}");
        using (var req = new UnityWebRequest(baseUrl + "/track", "POST")) {
          req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(payload.ToString()));
          req.downloadHandler = new DownloadHandlerBuffer();
          req.SetRequestHeader("Content-Type", "application/json");
          req.timeout = 20;
          yield return req.SendWebRequest();
          if (req.result == UnityWebRequest.Result.Success) { queue.RemoveRange(0, n); SaveQueue(); }
          else backendOk = false;
        }
      }
    }

    const char SEP = '\u0001';
    void SaveQueue() {
      PlayerPrefs.SetString("aibc_telem_q", string.Join(SEP.ToString(), queue));
    }
    void LoadQueue() {
      var raw = PlayerPrefs.GetString("aibc_telem_q", "");
      if (raw.Length > 0) queue.AddRange(raw.Split(SEP));
    }
  }
}
