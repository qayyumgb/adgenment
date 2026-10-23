/**
 * Starter prompts for the AI Generate brief. These are intentionally
 * detailed, structured templates — the user picks one, edits the
 * [BRACKETED PLACEHOLDERS] to fit their product/offer, and sends. The brief
 * drives BOTH copy generation (product / audience / offer / tone) AND the
 * image (the "Visual direction:" block becomes the image context). They're
 * written for text-to-image generation — we don't composite an uploaded
 * product photo yet, so the visual direction describes a scene to render
 * rather than a product to place. Anything in [brackets] is meant to be
 * replaced.
 */
export const PROMPT_TEMPLATES: { label: string; brief: string }[] = [
  {
    label: "E-commerce product + sale",
    brief: [
      "Promote [PRODUCT] to [AUDIENCE — e.g. \"women 25–40 who shop sustainable brands\"].",
      "",
      "Goal: drive sales.",
      "Key benefit: [the #1 reason to buy — e.g. \"lasts 3× longer than the alternatives\"].",
      "Offer: [e.g. \"sitewide sale, 20% off, free shipping over $50, ends Sunday\"].",
      "Tone: [e.g. confident and warm].",
      "",
      "Visual direction: photo-realistic shot of [PRODUCT] [in/on SETTING — e.g. \"a sunlit modern kitchen counter\"]. Natural lighting, realistic shadows and reflections, shallow depth of field, premium e-commerce look. No text, logos, or watermarks in the image.",
    ].join("\n"),
  },
  {
    label: "SaaS free-trial signup",
    brief: [
      "Promote a free [14-day] trial of [PRODUCT], a [one line on what it does] for [AUDIENCE — e.g. \"small-business owners\"].",
      "",
      "Goal: trial signups.",
      "Key benefit: [e.g. \"cut reporting from hours to minutes\"].",
      "Proof: [e.g. \"used by 12,000+ teams\", \"no credit card required\"].",
      "Tone: [e.g. clear and credible, no hype].",
      "",
      "Visual direction: clean, modern lifestyle scene of [WHO] using a laptop or phone in [SETTING — e.g. \"a bright, uncluttered workspace\"]. Realistic lighting, professional, aspirational. No UI screenshots, text, or logos in the image.",
    ].join("\n"),
  },
  {
    label: "DTC product launch",
    brief: [
      "Launch [PRODUCT] to first-time buyers [aged 25–40].",
      "",
      "Goal: launch-week sales.",
      "Hero feature: [e.g. \"clinically tested, visible results in 2 weeks\"].",
      "Social proof: [e.g. \"5,000+ on the waitlist\", \"rated 4.8/5\"].",
      "Offer: [e.g. \"15% off launch week only\"].",
      "Tone: [e.g. fresh, bold, premium].",
      "",
      "Visual direction: striking hero shot of [PRODUCT] in [STYLE/SETTING — e.g. \"a minimalist studio with a soft gradient backdrop\"]. Crisp focus, balanced commercial lighting, brand-forward. No text or logos in the image.",
    ].join("\n"),
  },
  {
    label: "Local service lead-gen",
    brief: [
      "Generate leads for [BUSINESS — e.g. \"a home HVAC service\"] targeting homeowners within [25 miles] of [CITY/AREA].",
      "",
      "Goal: free-quote requests and calls.",
      "Why trust us: [e.g. \"licensed & insured, same-week availability, 5-star reviews\"].",
      "Offer: [e.g. \"free, no-obligation quote\"].",
      "Tone: [e.g. friendly, trustworthy, local].",
      "",
      "Visual direction: authentic real-world photo of [the service in action — e.g. \"a friendly technician at a customer's doorstep\"] in [SETTING]. Well-lit and approachable, not staged or stocky. No text or logos in the image.",
    ].join("\n"),
  },
  {
    label: "Food / café / restaurant",
    brief: [
      "Promote [DISH / MENU / OFFER] at [VENUE — e.g. \"a cozy neighborhood café\"] to [AUDIENCE — e.g. \"locals and weekend brunch-goers\"].",
      "",
      "Goal: [foot traffic / online orders / bookings].",
      "Key appeal: [e.g. \"freshly roasted, made to order\"].",
      "Offer: [e.g. \"buy-one-get-one before 10am\"].",
      "Tone: [e.g. warm, inviting, sensory].",
      "",
      "Visual direction: appetizing, photo-realistic shot of [DISH/DRINK] on [SURFACE — e.g. \"a rustic wooden table in soft morning light\"]. Rich color, natural shadows, mouth-watering detail, food-photography quality. No text or logos in the image.",
    ].join("\n"),
  },
  {
    label: "Webinar / event signup",
    brief: [
      "Fill seats for [a free webinar / event] on [TOPIC] aimed at [AUDIENCE — e.g. \"marketing professionals\"].",
      "",
      "Goal: registrations.",
      "Hook: [speaker or takeaway — e.g. \"led by [EXPERT]; 3 tactics you can apply the same day\"].",
      "Proof: [e.g. \"live Q&A, recording sent to all registrants\"].",
      "Tone: [e.g. credible and energetic].",
      "",
      "Visual direction: professional, modern scene suggesting [TOPIC — e.g. \"a confident speaker on stage\" or \"a focused professional at a laptop\"] in [SETTING]. Clean, aspirational, well-lit. No text or logos in the image.",
    ].join("\n"),
  },
];
