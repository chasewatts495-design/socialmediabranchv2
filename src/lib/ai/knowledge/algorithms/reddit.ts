const content = `
# Reddit Algorithm Playbook

Reddit ranking is comparatively simple and time-decayed - the hard part is cultural. Every
subreddit is a distinct community with its own norms, moderators, and immune system against
marketing. Winning on Reddit means earning membership, not gaming a feed.

## Ranking signals

1. **Early upvote ratio and velocity.** The Hot ranking is roughly log-scaled score against post
   age: the first 10 upvotes matter as much as the next 100. A post's fate in a subreddit is
   widely observed to be decided in the first 30 to 60 minutes. Early downvotes are fatal because
   the ratio gates escalation to Hot and r/all.
2. **Subreddit fit.** Mods and community members punish off-tone posts instantly. Title
   conventions, flair usage, and format norms differ per subreddit; a perfect post for one sub
   dies in its neighbour. Read the top-all-time posts of a sub before posting.
3. **Comment velocity and depth.** Active comment threads extend a post's life on Hot and drive
   the "Best" sorting; posts that spark discussion outrank higher-scored posts that spark none.
4. **Account karma and age.** Many subs auto-filter accounts below karma or age thresholds.
   A seasoned account with history in the community passes both automod and human sniff tests.
5. **The 9:1 rule.** Reddit's own self-promotion guideline: at most 1 in 10 contributions should
   be your own content or links. Moderators and users actively check post histories; violating
   this is the most common cause of bans and removals for brands.
6. **Crossposts and external traffic.** Genuine crosspost pickup in adjacent subs multiplies
   reach; inorganic vote brigading from outside links triggers spam filtering.

## Format meta (current)

- **Text posts (self posts):** the native currency. Story-first, specific, zero marketing tone.
  Strong formats: post-mortems with real numbers, "I built/tested X, here is what happened",
  detailed guides, AMAs.
- **Images and galleries:** dominate casual subs; original photos beat polished graphics -
  production sheen reads as advertising.
- **Video:** native video over links; keep it raw.
- **Titles do 80 percent of the work:** specific, humble, curiosity-loaded, no clickbait
  punctuation. Numbers and concrete outcomes ("after 3 years", "for 41 dollars") perform.
- **Links:** allowed in some subs, filtered in many; a text post with the link in context or
  comments usually survives better where permitted.

## Timing and cadence

- Widely observed windows: 6 to 9am US Eastern on weekdays catches the morning-scroll build for
  US-heavy subs; Sunday evenings work for hobby subs. Match the sub's own activity rhythm.
- Cadence: quality over volume - a few genuinely strong posts per month per community, with daily
  commenting in between. Commenting is risk-free reach and karma-building.
- Decay: Hot placement lasts hours; big threads live 24 to 48 hours. But Reddit threads rank in
  Google for years - a top answer in a buying-advice thread is durable funnel real estate.

## Penalties and traps

- **Undisclosed promotion is the cardinal sin.** Astroturfing, fake accounts praising your
  product, and vote manipulation get accounts and domains sitewide-banned - and users who catch
  it will make the exposure itself go viral against you.
- **Breaking the 9:1 rule** or dropping bare product links flags you to automod and mods.
- **Copy-pasting the same post across subs** within a short window reads as spam.
- **Ignoring flair/format rules** gets silent automod removals - always check a sub's rules page.
- **Corporate voice.** First-person, disclosed, casual, willing-to-be-criticised accounts survive;
  press-release tone dies.

## Levers ranked by impact

1. Spend 2 to 4 weeks commenting genuinely in target subs before the first post.
2. Write the title like a community member sharing a result, never like a marketer.
3. Post at the sub's morning-build window and stay live to answer comments in hour one.
4. Disclose affiliation plainly when relevant - disclosure plus usefulness is widely tolerated.
5. Mine the sub's top-all-time posts for proven title and format patterns.
6. Target evergreen advice threads in your category for long-tail Google traffic.
`;
export default content;
