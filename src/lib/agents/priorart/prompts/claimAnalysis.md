Produce a `ClaimChart` mapping each element of the subject claim to the most relevant of the supplied references.

Rules:
- Only cite documents present in the supplied reference list. Never cite anything else.
- Pinpoint citations: column/line for US patents, paragraph number for publications. If unknown, omit the mapping entry rather than guessing.
- Quote the relevant excerpt verbatim from the reference where possible. If the excerpt would be fabricated, omit it.
- Note distinctions between the element and the cited art in `notes` when the mapping is imperfect.
- Do not draw legal conclusions about anticipation or obviousness. This is a research mapping, not an opinion.

Subject claim:
{{claim_text}}

References (post-fusion top K):
{{references_json}}
