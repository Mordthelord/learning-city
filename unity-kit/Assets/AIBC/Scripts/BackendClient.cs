// AI.B.C — backend client. Same server the HTML game uses:
//   POST /generate-content  { topic, grade, curriculum?, exclude[] }  -> GenerateResponse
//   GET  /health
// Drop on a bootstrap GameObject; call StartCoroutine(GetBank(...)).
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

namespace AIBC {
  public class BackendClient : MonoBehaviour {
    [Tooltip("The deployed server. Same one the web build uses.")]
    public string baseUrl = "https://learning-city-api.onrender.com";

    // simple in-memory cache: topic|grade -> bank (matches the web game's behavior)
    readonly Dictionary<string, QuestionBank> cache = new();

    public IEnumerator Health(System.Action<bool> done) {
      using var req = UnityWebRequest.Get(baseUrl + "/health");
      req.timeout = 8;
      yield return req.SendWebRequest();
      done(req.result == UnityWebRequest.Result.Success);
    }

    [System.Serializable] class GenBody { public string topic; public int grade; public string curriculum; public string[] exclude; }

    public IEnumerator GetBank(string topic, int grade, string curriculum, string[] exclude,
                               System.Action<QuestionBank> onBank, System.Action<string> onFail) {
      string key = topic + "|" + grade;
      if (cache.TryGetValue(key, out var hit) && (exclude == null || exclude.Length == 0)) { onBank(hit); yield break; }

      var body = new GenBody { topic = topic, grade = grade, curriculum = curriculum ?? "", exclude = exclude ?? new string[0] };
      using var req = new UnityWebRequest(baseUrl + "/generate-content", "POST");
      byte[] raw = System.Text.Encoding.UTF8.GetBytes(JsonUtility.ToJson(body));
      req.uploadHandler = new UploadHandlerRaw(raw);
      req.downloadHandler = new DownloadHandlerBuffer();
      req.SetRequestHeader("Content-Type", "application/json");
      req.timeout = 45;   // Render free tier can cold-start
      yield return req.SendWebRequest();

      if (req.result != UnityWebRequest.Result.Success) { onFail("network: " + req.error); yield break; }
      var res = JsonUtility.FromJson<GenerateResponse>(req.downloadHandler.text);
      if (res == null || !res.ok || res.bank == null) { onFail(res != null ? res.reason : "bad response"); yield break; }
      cache[key] = res.bank;
      onBank(res.bank);
    }
  }
}
