import { expect, it, vi } from "vitest";
import { searchMlcWorks } from "../searchMlcWorks";
it("sends title and writer identifiers, retains candidates without claiming identity", async () => {
  const raw = [
    {
      mlcSongCode: "123",
      workTitle: "Song",
      iswc: "T123",
      writers: [{ writerIPI: "00001234567", writerLastName: "Smith" }],
    },
  ];
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(raw));
  const result = await searchMlcWorks(
    { title: " Song ", writers: [{ writerIPI: "00001234567" }] },
    "secret-token",
    fetcher,
  );
  expect(JSON.parse(fetcher.mock.calls[0][1].body as string)).toEqual({
    title: "Song",
    writers: [{ writerIPI: "00001234567" }],
  });
  expect(result.status).toBe("candidate_found");
  expect(result.identityConfirmed).toBe(false);
  expect(result.candidates).toEqual(raw);
  expect(JSON.stringify(result)).not.toContain("secret-token");
});
it("keeps ambiguous works and empty results explicit", async () => {
  const result = await searchMlcWorks({ title: "Song" }, "token", async () =>
    Response.json([{ mlcSongCode: "1" }, { mlcSongCode: "2" }]),
  );
  expect(result.status).toBe("needs_review");
  expect(result.candidates).toHaveLength(2);
  expect(
    (await searchMlcWorks({ title: "Song" }, "token", async () => Response.json([]))).status,
  ).toBe("not_found");
});
it("rejects empty searches before any provider request", async () => {
  const fetcher = vi.fn();
  await expect(searchMlcWorks({ title: " " }, "token", fetcher)).rejects.toThrow();
  await expect(
    searchMlcWorks({ title: "Song", writers: [{}] }, "token", fetcher),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("does not turn provider failures or malformed rows into no matches", async () => {
  await expect(
    searchMlcWorks({ title: "Song" }, "token", async () => new Response(null, { status: 401 })),
  ).rejects.toThrow("401");
  await expect(
    searchMlcWorks({ title: "Song" }, "token", async () => Response.json([{ workTitle: "Song" }])),
  ).rejects.toThrow();
});
