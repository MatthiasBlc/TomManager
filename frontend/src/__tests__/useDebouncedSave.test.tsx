import { renderHook, act, waitFor } from "@testing-library/react";
import { useDebouncedSave } from "../hooks/useDebouncedSave";

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

const flush = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe("useDebouncedSave", () => {
  it("never saves on mount", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useDebouncedSave("initial", onSave));
    await flush(2000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("groups a burst of changes into a single save of the last value", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ v }) => useDebouncedSave(v, onSave, 600), {
      initialProps: { v: "a" },
    });
    for (const v of ["ab", "abc", "abcd"]) {
      rerender({ v });
      await flush(100);
    }
    await flush(600);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith("abcd");
  });

  // Filet de securite : sans lui, allonger le debounce ferait perdre la derniere
  // saisie quand l'utilisateur ferme la modale ou change d'onglet juste apres avoir
  // tape (le cleanup annule le timer en attente).
  it("flushes a pending value on unmount instead of dropping it", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = renderHook(({ v }) => useDebouncedSave(v, onSave, 1200), {
      initialProps: { v: "a" },
    });
    rerender({ v: "ab" });
    await flush(200); // toujours dans la fenetre de debounce
    expect(onSave).not.toHaveBeenCalled();

    unmount();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("ab"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("does not re-send on unmount when everything is already saved", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = renderHook(({ v }) => useDebouncedSave(v, onSave, 600), {
      initialProps: { v: "a" },
    });
    rerender({ v: "ab" });
    await flush(600);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    unmount();
    await flush(100);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("does not re-send on unmount while a save is still in flight", async () => {
    let resolveSave: () => void = () => undefined;
    const onSave = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );
    const { rerender, unmount } = renderHook(({ v }) => useDebouncedSave(v, onSave, 600), {
      initialProps: { v: "a" },
    });
    rerender({ v: "ab" });
    await flush(600);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    // Demontage alors que la requete n'a pas encore repondu : elle est deja partie.
    unmount();
    resolveSave();
    await flush(100);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
