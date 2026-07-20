// AI.B.C — the learning economy's wallet. Coins come only from thinking.
using UnityEngine;

namespace AIBC {
  public static class CoinWallet {
    public static System.Action<int, int> OnChanged;   // (newTotal, delta)

    public static int Coins {
      get { return PlayerPrefs.GetInt("aibc_coins", 0); }
      private set { PlayerPrefs.SetInt("aibc_coins", value); PlayerPrefs.Save(); }
    }

    public static void Add(int n, string why = null) {
      if (n == 0) return;
      Coins = Mathf.Max(0, Coins + n);
      if (OnChanged != null) OnChanged(Coins, n);
    }

    public static bool Spend(int n) {
      if (Coins < n) return false;
      Coins = Coins - n;
      if (OnChanged != null) OnChanged(Coins, -n);
      return true;
    }
  }
}
