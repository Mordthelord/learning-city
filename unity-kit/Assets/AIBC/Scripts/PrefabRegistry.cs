// AI.B.C — the asset plug-in point. The whole scaffold runs on primitives;
// when you buy Synty (or any) packs, create one of these assets
// (right-click in Project window → Create → AIBC → Prefab Registry),
// drag prefabs into the slots, and assign it on the GameBootstrap component.
// No code changes — every builder checks here first, primitives are the fallback.
using UnityEngine;

namespace AIBC {
  [CreateAssetMenu(menuName = "AIBC/Prefab Registry", fileName = "AIBCPrefabRegistry")]
  public class PrefabRegistry : ScriptableObject {
    public static PrefabRegistry Active;   // set by GameBootstrap

    [Header("Characters")]
    public GameObject player;              // rigged character (Mixamo/Synty)
    public GameObject[] npcs;              // crowd variety

    [Header("City")]
    public GameObject[] houses;            // small district buildings
    public GameObject[] towers;            // downtown blocks
    public GameObject[] trees;
    public GameObject[] streetProps;       // lamps, benches, hydrants…
    public GameObject roadStraight;        // road tiles (Synty city packs have these)
    public GameObject roadCrossing;

    [Header("Gameplay")]
    public GameObject chest;               // question chest model
    public GameObject coin;                // coin pickup model

    public GameObject Pick(GameObject[] arr, int seed) {
      if (arr == null || arr.Length == 0) return null;
      return arr[Mathf.Abs(seed) % arr.Length];
    }
  }
}
