// AI.B.C — base class for anything the player can walk up to and press E on.
// InteractionScanner (on the player) finds the nearest one and shows its prompt.
using UnityEngine;

namespace AIBC {
  public abstract class Interactable : MonoBehaviour {
    public string prompt = "Press E";
    public float radius = 3f;
    public abstract void Interact(PlayerController player);
  }

  public class InteractionScanner : MonoBehaviour {
    Interactable nearest;
    float scanTimer;

    void Update() {
      scanTimer -= Time.deltaTime;
      if (scanTimer <= 0f) { scanTimer = 0.2f; Scan(); }
      if (nearest != null && !PlayerController.InputLocked && Input.GetKeyDown(KeyCode.E))
        nearest.Interact(GetComponent<PlayerController>());
    }

    void Scan() {
      nearest = null;
      float best = float.MaxValue;
      var all = Object.FindObjectsByType<Interactable>(FindObjectsSortMode.None);
      for (int i = 0; i < all.Length; i++) {
        float d = Vector3.Distance(transform.position, all[i].transform.position);
        if (d < all[i].radius && d < best) { best = d; nearest = all[i]; }
      }
      UIHud.SetPrompt(nearest != null ? nearest.prompt : null);
    }
  }
}
