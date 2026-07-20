// AI.B.C — offline question generator (port of the web game's fallback).
// If BackendClient fails (no internet / server napping), play never breaks.
using System.Collections.Generic;
using UnityEngine;

namespace AIBC {
  public static class OfflineQuestionFallback {
    public static QuestionBank TimesTables(int grade) {
      var rng = new System.Random();
      QuestionItem Make(int aMin, int aMax) {
        int a = rng.Next(aMin, aMax), b = rng.Next(2, 12);
        int correct = a * b;
        var opts = new HashSet<int> { correct };
        while (opts.Count < 3) opts.Add(correct + rng.Next(-9, 10) * (rng.Next(0, 2) == 0 ? 1 : 2));
        var answers = new List<string>(); foreach (var o in opts) answers.Add(o.ToString());
        Shuffle(answers, rng);
        return new QuestionItem { target = a + " × " + b, answers = answers.ToArray(), correct = correct.ToString() };
      }
      QuestionItem[] Tier(int lo, int hi) { var t = new QuestionItem[8]; for (int i = 0; i < 8; i++) t[i] = Make(lo, hi); return t; }
      return new QuestionBank {
        subject = "math", label = "Times Tables", prompt = "Pick the ANSWER to",
        easy = Tier(2, 6), medium = Tier(4, 10), hard = Tier(7, 13)
      };
    }
    static void Shuffle(List<string> l, System.Random rng) {
      for (int i = l.Count - 1; i > 0; i--) { int j = rng.Next(i + 1); (l[i], l[j]) = (l[j], l[i]); }
    }
  }
}
