// AI.B.C — one place the whole game asks for its next question.
// Ports the web build's rules: difficulty ramps up after 3-streaks and eases
// after 2 misses; questions never repeat within a session; banks come from the
// live backend when reachable and the offline generator when not.
using System.Collections.Generic;
using UnityEngine;

namespace AIBC {
  public class QuestionService : MonoBehaviour {
    public static QuestionService I;

    public string topic = "multiplication";
    public int grade = 4;

    BackendClient api;
    QuestionBank bank;
    readonly HashSet<string> seen = new HashSet<string>();
    int tier = 1, streak, missStreak;

    void Awake() {
      I = this;
      api = GetComponent<BackendClient>();
      if (api == null) api = gameObject.AddComponent<BackendClient>();
      Refill();
    }

    void Refill() {
      var exclude = new List<string>(seen).ToArray();
      StartCoroutine(api.GetBank(topic, grade, null, exclude,
        b => { bank = b; UIHud.Toast("Fresh AI questions: " + b.label); },
        why => { bank = OfflineQuestionFallback.TimesTables(grade);
                 Debug.Log("offline questions (" + why + ")"); }));
    }

    QuestionItem[] TierItems() {
      if (bank == null) bank = OfflineQuestionFallback.TimesTables(grade);
      if (tier <= 0) return bank.easy;
      if (tier == 1) return bank.medium;
      return bank.hard;
    }

    public QuestionItem Next() {
      var items = TierItems();
      // first unseen question in the current tier; refill the bank when dry
      for (int pass = 0; pass < 2; pass++) {
        foreach (var q in items) {
          if (q != null && !seen.Contains(q.target)) { seen.Add(q.target); return q; }
        }
        Refill();                                    // async — fall through to offline for now
        bank = OfflineQuestionFallback.TimesTables(grade);
        items = TierItems();
      }
      return items[Random.Range(0, items.Length)];   // absolute fallback
    }

    public int Tier { get { return tier; } }

    public void ReportAnswer(bool firstTry) {
      if (firstTry) { missStreak = 0; if (++streak >= 3) { streak = 0; tier = Mathf.Min(2, tier + 1); } }
      else { streak = 0; if (++missStreak >= 2) { missStreak = 0; tier = Mathf.Max(0, tier - 1); } }
    }
  }
}
