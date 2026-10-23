export const AUDIENCE_TEMPLATES: { label: string; body: string }[] = [
  {
    label: "E-commerce buyers",
    body: [
      "Online shoppers aged [25–45] in [United States] who buy [sustainable fashion] online.",
      "Interested in [organic cotton, slow fashion, ethical brands] and follow [eco-friendly clothing labels].",
      "Likely to have purchased [apparel or accessories] in the last [30 days].",
    ].join("\n"),
  },
  {
    label: "SaaS decision-makers",
    body: [
      "[Founders, marketing leads, and operations managers] aged [28–50] in [the US and UK].",
      "Work at [small-to-mid B2B software companies], interested in [productivity tools, automation, CRM, analytics].",
      "Actively evaluating [marketing or sales software].",
    ].join("\n"),
  },
  {
    label: "Local service customers",
    body: [
      "Homeowners aged [30–60] within [25 miles of [your city]].",
      "Interested in [home improvement, interior design, gardening] and likely to hire [local contractors/services].",
      "Household income [middle to upper].",
    ].join("\n"),
  },
  {
    label: "Fitness & wellness",
    body: [
      "[Health-conscious adults] aged [22–40] in [United States].",
      "Interested in [fitness, nutrition, yoga, supplements, activewear] and follow [wellness influencers and gym brands].",
      "Likely to buy [workout gear or health products] online.",
    ].join("\n"),
  },
  {
    label: "Warm retargeting",
    body: [
      "People who recently [visited my website or added to cart] but didn't purchase.",
      "Aged [25–50] in [United States], interested in [your product category].",
      "Re-engage with a [limited-time offer].",
    ].join("\n"),
  },
];
