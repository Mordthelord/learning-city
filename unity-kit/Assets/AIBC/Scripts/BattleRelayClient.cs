// AI.B.C — class-PIN battle client for the SAME relay the web build uses (WebSocket /ws).
// Requires the NativeWebSocket package:  https://github.com/endel/NativeWebSocket
//   (Window ▸ Package Manager ▸ + ▸ Add package from git URL ▸
//    https://github.com/endel/NativeWebSocket.git#upm )
// Protocol (JSON): {t:"host"|"join"|"sub"|"start"|"update"|"submit", pin, id, name, gameId, score}
// Server broadcasts: {type:"room", pin, room:{pin,gameId,started,players:[{id,name,score,done}]}}
using System;
using UnityEngine;
using NativeWebSocket;

namespace AIBC {
  [Serializable] public class BattlePlayer { public string id; public string name; public int score; public bool done; }
  [Serializable] public class BattleRoom { public string pin; public string gameId; public bool started; public BattlePlayer[] players; }
  [Serializable] class RoomMsg { public string type; public string pin; public BattleRoom room; }
  [Serializable] class OutMsg { public string t; public string pin; public string id; public string name; public string gameId; public int score; }

  public class BattleRelayClient : MonoBehaviour {
    public string baseUrl = "wss://learning-city-api.onrender.com/ws";
    public event Action<BattleRoom> OnRoom;

    WebSocket ws;
    readonly string myId = "u_" + Guid.NewGuid().ToString("N").Substring(0, 8);
    public string Pin { get; private set; }
    public string MyId => myId;

    public async void Connect() {
      ws = new WebSocket(baseUrl);
      ws.OnMessage += (bytes) => {
        var msg = JsonUtility.FromJson<RoomMsg>(System.Text.Encoding.UTF8.GetString(bytes));
        if (msg != null && msg.type == "room" && msg.pin == Pin) OnRoom?.Invoke(msg.room);
      };
      await ws.Connect();
    }
    void Update() {
      #if !UNITY_WEBGL || UNITY_EDITOR
      ws?.DispatchMessageQueue();
      #endif
    }
    async void Send(OutMsg m) { if (ws != null && ws.State == WebSocketState.Open) await ws.SendText(JsonUtility.ToJson(m)); }

    public string Host(string name, string gameId) {
      Pin = UnityEngine.Random.Range(100000, 999999).ToString();
      Send(new OutMsg { t = "host", pin = Pin, id = myId, name = name, gameId = gameId });
      return Pin;
    }
    public void Join(string pin, string name) { Pin = pin; Send(new OutMsg { t = "join", pin = pin, id = myId, name = name }); }
    public void StartRound(string gameId)     { Send(new OutMsg { t = "start", pin = Pin, gameId = gameId }); }
    public void UpdateScore(int score)        { Send(new OutMsg { t = "update", pin = Pin, id = myId, score = score }); }
    public void SubmitFinal(int score)        { Send(new OutMsg { t = "submit", pin = Pin, id = myId, score = score }); }
    async void OnDestroy() { if (ws != null) await ws.Close(); }
  }
}
