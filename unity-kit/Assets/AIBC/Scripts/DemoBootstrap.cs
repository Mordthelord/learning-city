// AI.B.C — DAY-ONE DEMO. Put this on an empty GameObject in a new scene and press Play.
// It proves the full loop with zero art: profile -> districts -> question bank -> quiz in the Console.
using UnityEngine;

namespace AIBC {
  [RequireComponent(typeof(BackendClient))]
  public class DemoBootstrap : MonoBehaviour {
    void Start() {
      var profile = new ChildProfile {
        childName = "Max", grade = 4,
        interests = new[] { "Sports", "Cars/Vehicles" },
        obsessions = "soccer, racing", subjects = new[] { "multiplication" }
      };
      var districts = DistrictSelector.Select(profile);
      Debug.Log("🌆 Districts for " + profile.childName + ": " + string.Join(", ", districts));

      var api = GetComponent<BackendClient>();
      StartCoroutine(api.GetBank(profile.subjects[0], profile.grade, null, null,
        bank => {
          Debug.Log("☁ LIVE bank: " + bank.label + " (" + bank.easy.Length + "/" + bank.medium.Length + "/" + bank.hard.Length + ")");
          Ask(bank);
        },
        why => {
          Debug.LogWarning("☁ backend unavailable (" + why + ") — using offline fallback, exactly like the web build");
          Ask(OfflineQuestionFallback.TimesTables(profile.grade));
        }));
    }
    void Ask(QuestionBank bank) {
      var q = bank.medium[0];
      Debug.Log("❓ " + bank.prompt + "  →  " + q.target + "   [" + string.Join(" | ", q.answers) + "]  (answer: " + q.correct + ")");
    }
  }
}
