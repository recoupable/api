import type { Template } from "./index";

const template: Template = {
  id: "album-record-store",
  description:
    "Vinyl record on display in a NYC record store. No artist on camera — product shot of the album. Promotional captions. Vertical 9:16 video, 8 seconds. Best for: release day, album promotion, single drops. Requires: audio. No face image needed.",
  image: {
    prompt:
      "A vinyl record spinning on a turntable inside a cramped, rundown New York City record store. The album cover art is displayed next to the turntable, propped against a stack of records. Wooden crate bins full of vinyl records fill the background. Warm tungsten overhead light, dust particles visible in the air. The store feels lived-in — peeling stickers on the counter, handwritten price tags, faded band posters on the walls. Phone camera, slightly warm color cast.",
    reference_images: [
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/album-record-store/ref-01.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hbGJ1bS1yZWNvcmQtc3RvcmUvcmVmLTAxLnBuZyIsImlhdCI6MTc3NTE4NTA1NywiZXhwIjoxODA2NzIxMDU3fQ.4_aouIYxW9jSZb6U9S_XOgygyVS4Nqg4uPJ0l5qNEz8",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/album-record-store/ref-02.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hbGJ1bS1yZWNvcmQtc3RvcmUvcmVmLTAyLnBuZyIsImlhdCI6MTc3NTE4NTA1NywiZXhwIjoxODA2NzIxMDU3fQ.FcKfpm79HH-cx4NIW_-EJJ7qaxM-LY-Ea72EF3U5zIU",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/album-record-store/ref-03.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hbGJ1bS1yZWNvcmQtc3RvcmUvcmVmLTAzLnBuZyIsImlhdCI6MTc3NTE4NTA1NywiZXhwIjoxODA2NzIxMDU3fQ.Dos9-VI40yCviZNSYRPcc0Owz9QJs1vHvmQ2ptFOCXs",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/album-record-store/ref-04.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hbGJ1bS1yZWNvcmQtc3RvcmUvcmVmLTA0LnBuZyIsImlhdCI6MTc3NTE4NTA1NywiZXhwIjoxODA2NzIxMDU3fQ.Dvk_unwcGS63a-VreepJf3Pm4nm4kYCL0-lThxUkL34",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/album-record-store/ref-05.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hbGJ1bS1yZWNvcmQtc3RvcmUvcmVmLTA1LnBuZyIsImlhdCI6MTc3NTE4NTA1NywiZXhwIjoxODA2NzIxMDU3fQ.KCvBqIkjVmAKj4xoU3y5txw2mNwWl88cbj7Ln0u8v68",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/album-record-store/ref-06.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hbGJ1bS1yZWNvcmQtc3RvcmUvcmVmLTA2LnBuZyIsImlhdCI6MTc3NTE4NTA1NywiZXhwIjoxODA2NzIxMDU3fQ.BIGZ2WG15ecaodHkQ5aSprIGbFnXBjqBH62r_vdZ7Eg",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/album-record-store/ref-07.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hbGJ1bS1yZWNvcmQtc3RvcmUvcmVmLTA3LnBuZyIsImlhdCI6MTc3NTE4NTA1NywiZXhwIjoxODA2NzIxMDU3fQ.88e5hWeqa7d1vLhN4KnsGNKV1JXiU9a0zWHZtELJ9DE",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/album-record-store/ref-08.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hbGJ1bS1yZWNvcmQtc3RvcmUvcmVmLTA4LnBuZyIsImlhdCI6MTc3NTE4NTA1NywiZXhwIjoxODA2NzIxMDU3fQ.9MldLiE0pSW9smN402wQ-xewLBkNUNImn6hzoHY5zwU",
      "https://godremdqwajrwazhbrue.supabase.co/storage/v1/object/sign/user-files/templates/album-record-store/ref-09.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84MzUzZTIyMy04YWU5LTQxMDYtOWZiYi04Y2NhMjE3NDc5YWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ1c2VyLWZpbGVzL3RlbXBsYXRlcy9hbGJ1bS1yZWNvcmQtc3RvcmUvcmVmLTA5LnBuZyIsImlhdCI6MTc3NTE4NTA1NywiZXhwIjoxODA2NzIxMDU3fQ.p7iStudC3RxtBA_hZUP3sz5dOOtVAkVa9iDFB7ItwDU",
    ],
    style_rules: {
      camera: {
        type: "iPhone resting on the counter, recording a quick story",
        angle:
          "slightly above the turntable, looking down at an angle — like someone held their phone over the record to film it spinning",
        quality:
          "iPhone video quality — warm color cast from the overhead light, slight lens flare, not perfectly sharp, natural vignetting at corners",
        focus: "turntable and album art in focus, background bins and shelves slightly soft",
      },
      environment: {
        feel: "a real independent record store in lower Manhattan or Brooklyn — cramped, cluttered, full of character",
        lighting:
          "warm tungsten bulbs overhead, maybe a small desk lamp near the register. Pools of warm light, deep shadows between the bins. Dust particles catching the light.",
        backgrounds:
          "wooden crate bins overflowing with vinyl, hand-lettered genre dividers, faded concert posters and stickers on every surface, a boombox or old speakers on a high shelf, maybe a cat sleeping on a stack of records",
        avoid:
          "clean modern stores, bright fluorescent lighting, empty shelves, corporate branding, pristine surfaces, anything that looks new or staged",
      },
      subject: {
        expression: "N/A — no person in the shot, the subject is the album and turntable",
        pose: "N/A",
        clothing: "N/A",
        framing:
          "turntable takes up the lower half of frame, album art visible in the upper portion or to the side, surrounded by the store environment",
      },
      realism: {
        priority:
          "this MUST look like a real phone video taken inside an actual NYC record store, not a render or AI image",
        texture:
          "warm grain from the phone camera, slight dust and scratches visible on the vinyl, wood grain on the crate bins, worn edges on the record sleeves",
        imperfections:
          "fingerprints on the vinyl, slightly crooked album display, a price sticker on the sleeve, dust on the turntable platter, uneven stacks of records in the background",
        avoid:
          "clean renders, perfect symmetry, bright even lighting, glossy surfaces, anything that looks digital or AI-generated, stock-photo record stores",
      },
    },
  },
  video: {
    moods: [
      "warm nostalgia, like walking into a place that reminds you of being a kid",
      "quiet pride, the feeling of seeing something you made exist in the real world",
      "intimate, like youre showing a close friend something that matters to you",
      "reverent, the way people handle vinyl carefully because it feels sacred",
      "bittersweet, like the album captured a version of you that doesnt exist anymore",
      "hypnotic, the kind of calm that comes from watching something spin in circles",
      "peaceful solitude, alone in the store after hours",
      "wistful, like remembering the sessions that made this album",
    ],
    movements: [
      "the vinyl spins steadily, tonearm tracking the groove, dust particles drift through the warm light",
      "camera slowly drifts closer to the album art, the vinyl keeps spinning in the background",
      "a hand reaches into frame and gently places the needle on the record",
      "the turntable spins, the overhead light flickers once, dust motes float lazily",
      "someone flips through records in a crate in the background, out of focus, while the vinyl spins",
      "the camera barely moves, just the vinyl spinning and the warm light shifting slightly",
      "a slight camera drift to reveal more of the store — bins, posters, clutter — then settles back on the turntable",
      "the tonearm rides the groove, a tiny reflection of light glints off the spinning vinyl surface",
    ],
  },
  caption: {
    guide: {
      templateStyle:
        "album art on vinyl in a record store — the kind of post an artist makes when their music hits wax for the first time",
      captionRole:
        "the caption should feel like the artist posted this themselves. proud but not corny. announcing the vinyl, reflecting on the music, or saying something raw about what the album means.",
      tone: "understated pride, like posting a photo of your album in a store and letting the moment speak for itself. not hype-man energy — quiet flex.",
      rules: [
        "lowercase only",
        "keep it under 80 characters for short, can go longer for medium/long",
        "no punctuation at the end unless its a question mark",
        "never sound like a press release or marketing copy",
        "never say 'out now' or 'stream now' or 'link in bio'",
        "dont describe whats in the image",
        "can reference the album, the songs, or what they mean to you",
        "can reference the physical vinyl / record store experience",
        "if it sounds like a label wrote it, rewrite it until it sounds like the artist texted it to a friend",
      ],
      formats: [
        "a one-line reflection on the album ('i left everything in this one')",
        "a quiet flex about being on vinyl ('never thought id see this in a store')",
        "a nostalgic moment ('used to dig through bins like this looking for something that felt like home')",
        "something the listener would screenshot ('this album is the version of me i was scared to show you')",
        "a short dedication or thank you that feels real, not performative",
      ],
    },
    examples: [
      "i left everything in this one",
      "found myself in the crates today",
      "never thought id see my name on a spine in a record store",
      "wrote this in my bedroom now its on wax",
      "this album is the version of me i was scared to show you",
      "every scratch on this vinyl is a memory",
      "the songs sound different on wax. heavier somehow",
      "somebody in new york is gonna find this in a bin one day and feel something",
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
