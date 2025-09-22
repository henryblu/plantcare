import { describe, expect, it, vi } from "vitest";
import { PlantNetClient, PlantNetError } from "./plantNet";

describe("PlantNetClient", () => {
  const validImage = new Uint8Array([0xff, 0xd8, 0xff]);

  it("throws INVALID_IMAGE when an unsupported MIME type is provided", async () => {
    const client = new PlantNetClient({ fetchFn: vi.fn() });

    await expect(
      client.identify({
        images: [
          {
            data: validImage,
            contentType: "image/gif",
            filename: "sample.gif",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
  });

  it("retries a transient network failure once before succeeding", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
      });

    const client = new PlantNetClient({ fetchFn: fetchMock, timeoutMs: 0, retryAttempts: 1 });

    const result = await client.identify({
      images: [
        {
          data: validImage,
          contentType: "image/jpeg",
          filename: "photo.jpg",
        },
      ],
      limit: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([]);
  });

  it("wraps non-ok responses in an API_ERROR", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "Bad Gateway",
    });

    const client = new PlantNetClient({ fetchFn: fetchMock });

    await expect(
      client.identify({
        images: [
          {
            data: validImage,
            contentType: "image/jpeg",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "API_ERROR" });
  });
});
