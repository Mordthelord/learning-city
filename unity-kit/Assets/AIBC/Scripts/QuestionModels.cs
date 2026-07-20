// AI.B.C — question bank data models (mirror of the backend JSON, JsonUtility-compatible)
using System;

namespace AIBC {
  [Serializable] public class QuestionItem {
    public string target;     // what the child sees ("3 × 9", "synonym of quiet")
    public string[] answers;  // shuffled options (first correct answer NOT guaranteed first)
    public string correct;    // the right answer
  }
  [Serializable] public class QuestionBank {
    public string subject;    // "math" | "english" | "science"
    public string label;      // short topic title
    public string prompt;     // instruction line ("Drive into the ANSWER to…")
    public QuestionItem[] easy;
    public QuestionItem[] medium;
    public QuestionItem[] hard;
  }
  [Serializable] public class GenerateResponse {
    public bool ok;
    public string reason;     // set when ok=false (unsafe topic, no key, …)
    public QuestionBank bank;
  }
}
