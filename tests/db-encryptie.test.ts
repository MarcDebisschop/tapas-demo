import { describe, it, expect, afterEach } from "vitest";
import { pasEncryptieToe, isEncryptieGeconfigureerd } from "../server/db-encryptie";

describe("FIX 6 - encryptie at rest hook", () => {
  const origineel = process.env.TAPAS_DB_SLEUTEL;
  afterEach(() => {
    if (origineel === undefined) delete process.env.TAPAS_DB_SLEUTEL;
    else process.env.TAPAS_DB_SLEUTEL = origineel;
  });

  it("is een no-op zonder sleutel: roept pragma niet aan", () => {
    delete process.env.TAPAS_DB_SLEUTEL;
    let aangeroepen = false;
    pasEncryptieToe({ pragma: () => { aangeroepen = true; } });
    expect(aangeroepen).toBe(false);
    expect(isEncryptieGeconfigureerd()).toBe(false);
  });

  it("past PRAGMA key toe wanneer een sleutel gezet is", () => {
    process.env.TAPAS_DB_SLEUTEL = "geheim-123";
    let ontvangen = "";
    pasEncryptieToe({ pragma: (s: string) => { ontvangen = s; return null; } });
    expect(ontvangen).toBe("key='geheim-123'");
    expect(isEncryptieGeconfigureerd()).toBe(true);
  });

  it("ontdubbelt aanhalingstekens in de sleutel (geen pragma-injectie)", () => {
    process.env.TAPAS_DB_SLEUTEL = "a'b";
    let ontvangen = "";
    pasEncryptieToe({ pragma: (s: string) => { ontvangen = s; return null; } });
    expect(ontvangen).toBe("key='a''b'");
  });

  it("crasht niet wanneer de driver geen pragma ondersteunt", () => {
    process.env.TAPAS_DB_SLEUTEL = "x";
    expect(() => pasEncryptieToe({} as any)).not.toThrow();
  });
});
