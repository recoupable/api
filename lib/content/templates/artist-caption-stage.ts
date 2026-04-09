import type { Template } from "./types";

const template: Template = {
  id: "artist-caption-stage",
  description:
    "Small venue fan cam. Artist on camera from crowd perspective, performance energy. Hype short captions. Vertical 9:16 video, 8 seconds. Best for: upbeat songs, live feel, hype moments. Requires: face image, audio.",
  image: {
    prompt:
      "A person performing on a small stage at a live show. Fan cam perspective — phone held up in the crowd. Stage lights, slightly blurry, not professional photography.",
    reference_images: [
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/artist-caption-stage/ref-01.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hcnRpc3QtY2FwdGlvbi1zdGFnZS9yZWYtMDEucG5nIiwiaWF0IjoxNzc1MTg1MDU1LCJleHAiOjE4MDY3MjEwNTV9.Ff9Olh-7AH9hpGsnoNjm137i_z5QasP6W6fkd7UgXHs",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/artist-caption-stage/ref-02.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hcnRpc3QtY2FwdGlvbi1zdGFnZS9yZWYtMDIucG5nIiwiaWF0IjoxNzc1MTg1MDU2LCJleHAiOjE4MDY3MjEwNTZ9.5h8pm3f3ns8UOpRII5klLBY6hjyNKc4eln-y2RhOoZw",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/artist-caption-stage/ref-03.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hcnRpc3QtY2FwdGlvbi1zdGFnZS9yZWYtMDMucG5nIiwiaWF0IjoxNzc1MTg1MDU2LCJleHAiOjE4MDY3MjEwNTZ9.Zth40VhNl3aV-IXcRdNrVpJxfDnG9OX8d0lhd3iYUW8",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/artist-caption-stage/ref-04.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hcnRpc3QtY2FwdGlvbi1zdGFnZS9yZWYtMDQucG5nIiwiaWF0IjoxNzc1MTg1MDU2LCJleHAiOjE4MDY3MjEwNTZ9.SVMtgCM9TJ0DEJPB6mXfhu6lLI5ttjpCNNUmyntToTs",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/artist-caption-stage/ref-05.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hcnRpc3QtY2FwdGlvbi1zdGFnZS9yZWYtMDUucG5nIiwiaWF0IjoxNzc1MTg1MDU2LCJleHAiOjE4MDY3MjEwNTZ9.zOthD-7e3-TrRbwygF9ydyAJnycli6ewj8sd_xpHYBs",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/artist-caption-stage/ref-06.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hcnRpc3QtY2FwdGlvbi1zdGFnZS9yZWYtMDYucG5nIiwiaWF0IjoxNzc1MTg1MDU2LCJleHAiOjE4MDY3MjEwNTZ9.4NYpj1wRqwFLf5i_k_vrw8CSg6tTf_kkvaIafwbTfdw",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/artist-caption-stage/ref-07.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hcnRpc3QtY2FwdGlvbi1zdGFnZS9yZWYtMDcucG5nIiwiaWF0IjoxNzc1MTg1MDU2LCJleHAiOjE4MDY3MjEwNTZ9._4ytmg9RN6SR_M6Eo0mNc_kYG5XkCPKp50ApqMg6qq4",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/artist-caption-stage/ref-08.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hcnRpc3QtY2FwdGlvbi1zdGFnZS9yZWYtMDgucG5nIiwiaWF0IjoxNzc1MTg1MDU2LCJleHAiOjE4MDY3MjEwNTZ9.QI2pPs1lDDOHN-BqeSjNm8Fu0TJJwOagcDKCXyb1AqQ",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/artist-caption-stage/ref-09.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hcnRpc3QtY2FwdGlvbi1zdGFnZS9yZWYtMDkucG5nIiwiaWF0IjoxNzc1MTg1MDU2LCJleHAiOjE4MDY3MjEwNTZ9.rDvcjb4DhlC8w7ehpgvL8x7PScPfiQaUQg56vpIIy-4",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/artist-caption-stage/ref-10.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hcnRpc3QtY2FwdGlvbi1zdGFnZS9yZWYtMTAucG5nIiwiaWF0IjoxNzc1MTg1MDU3LCJleHAiOjE4MDY3MjEwNTd9.oQ4VKoltTJJPSQMfJ8E0mEh1mtDXN0JigntzoIhmPo8",
    ],
    style_rules: {
      camera: {
        type: "iPhone held up in a crowd recording a concert",
        angle: "slightly below stage level, looking up at performer, not perfectly centered",
        quality:
          "iPhone video screenshot quality — compressed, noisy, not sharp. Digital noise in dark areas. Slight purple fringing on highlights.",
      },
      environment: {
        feel: "cramped small venue, sweaty, dark, someone's phone screen glowing in the corner",
        lighting:
          "harsh stage spots from above — blown out orange and red highlights, deep black shadows, face half in darkness. Light spill is uneven and messy.",
        backgrounds:
          "out of focus crowd silhouettes, blurry stage equipment, maybe a phone screen or two glowing in the audience, exit sign in the distance",
        avoid:
          "even lighting, clean backgrounds, arena-sized venues, professional concert photography, perfectly exposed images, visible detail in dark areas",
      },
      subject: {
        expression: "mid-performance — eyes closed singing, chin up, lost in the music",
        pose: "holding mic close, one hand up, or gripping mic stand, slightly blurry from movement",
        clothing: "dark — black hoodie, dark jacket, nothing bright or styled",
        framing:
          "not perfectly framed — subject slightly off center, maybe someone's head partially blocking the bottom, cropped awkwardly like a real phone photo",
      },
      realism: {
        priority:
          "this MUST look like a screenshot from someone's iPhone concert video, not a professional photo or AI image",
        texture:
          "heavy digital noise in shadows, JPEG compression artifacts, slight color banding in gradients, skin has no retouching",
        imperfections:
          "lens flare bleeding across frame, blown out stage light spots that are pure white, someone's hand or phone slightly visible at edge of frame, chromatic aberration on bright lights, slight motion blur on performer's hands",
        avoid:
          "clean noise-free images, perfect skin, sharp focus on everything, symmetrical composition, studio quality, any sign of AI generation",
      },
    },
  },
  video: {
    moods: [],
    movements: [],
  },
  caption: {
    guide: {
      templateStyle:
        "live performance with emotional or lyric caption — the artist on stage with words that hit",
      captionRole:
        "the caption adds emotional weight to the image. it can be a lyric, a question, a confession, or a thought that makes the viewer feel something while looking at the performance",
      tone: "raw, emotional, vulnerable, poetic — like the artist is speaking directly to one person in the crowd",
      rules: [
        "lowercase only",
        "max 100 characters (can be longer than casual template since its more emotional)",
        "apostrophes are allowed (im, youre, dont all ok — but also i'm, you're, don't all ok)",
        "question marks are allowed",
        "never promotional",
        "never describe what's in the image",
        "can be a direct lyric quote from the song",
        "can be a rhetorical question",
        "should feel like the artist is saying it mid-performance",
      ],
      formats: [
        "a lyric line that hits hardest out of context",
        "a rhetorical question directed at someone specific",
        "a confession that feels too honest for a stage",
        "a one-line gut punch",
        "something that makes you screenshot and send to someone",
      ],
    },
    examples: [
      "how can you look at me and pretend i'm someone you've never met?",
      "i wrote this song about you and you don't even know",
      "every time i sing this part i think about leaving",
      "this is the last song i'll ever write about you",
      "i hope you hear this and it ruins your whole night",
    ],
  },
  edit: {
    operations: [
      { type: "crop", aspect: "9:16" },
      {
        type: "overlay_text",
        color: "white",
        stroke_color: "black",
        position: "bottom",
        max_font_size: 42,
      },
      { type: "mux_audio", replace: true },
    ],
  },
};

export default template;
