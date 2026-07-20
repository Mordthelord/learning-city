// AI.B.C — session accounting (the web build's LOG): answers, streaks,
// first-try accuracy — all reported to the shared telemetry dashboard.
using UnityEngine;

namespace AIBC {
  public static class GameSession {
    public static string CurrentGame = "city_freeplay";
    static int attempted, firstTryCount, streak, bestStreak;

    public static void StartGame(string id, string name) {
      CurrentGame = id;
      attempted = firstTryCount = streak = bestStreak = 0;
      TelemetryClient.Track("game_start", "tpl", id, "name", name,
        "subject", QuestionService.I != null ? QuestionService.I.topic : "");
    }

    public static void RecordAnswer(bool firstTry, int tier, float seconds) {
      attempted++;
      if (firstTry) { firstTryCount++; streak++; bestStreak = Mathf.Max(bestStreak, streak); }
      else streak = 0;
      TelemetryClient.Track("answer", "tpl", CurrentGame,
        "subject", QuestionService.I != null ? QuestionService.I.topic : "",
        "ok", firstTry, "tier", tier, "rt", Mathf.RoundToInt(seconds * 1000f));
    }

    public static void EndGame(string name) {
      int acc = attempted > 0 ? Mathf.RoundToInt(100f * firstTryCount / attempted) : 0;
      TelemetryClient.Track("game_end", "tpl", CurrentGame, "name", name,
        "answered", attempted, "acc", acc, "streak", bestStreak);
    }

    public static void Rate(string tpl, string name, int stars, string diff, string text) {
      TelemetryClient.Track("rating", "tpl", tpl, "name", name,
        "stars", stars, "diff", diff ?? "", "text", text ?? "");
    }
  }
}
