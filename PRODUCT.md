## Design Context

### Users

主要使用者是项目作者本人，也会公开分享给其他书影爱好者。这是一个**个人优先、欢迎旁观**的产品形态——以单人长期沉淀为主轴（书单、看过、阅读偏好），但 onboarding、空状态、分享出去的链接首屏要让陌生访客也能立刻读懂气质。

使用场景：在沙发上、地铁上、深夜灯下，用手机或桌面浏览器查一本书 / 一部电影、把它收下来、之后回来翻翻自己看过的。状态是**慢的、安静的、私人的**，不是工作流、不是任务清单。

### Brand Personality

**安静、温润、像翻一本旧书。**

- 语调：克制、低声、可以有一点编辑感的私人化笔触；不要客服感、不要营销感、不要技术炫耀。
- 情绪目标：让人想停下来读一段简介、想点开下一本，而不是想刷下一条。
- 不要让用户感到「被运营」「被 push」「被指标驱动」。

### Aesthetic Direction

**编辑式排版的克制路数（editorial-typographic, restrained）。**

- 暖色 paper 底（#f6efe5）+ ink 棕字 + clay 陶土橙 primary，warm-tint 阴影。底色与字色都偏向暖棕家族，绝不出现纯白 / 纯黑 / 冷灰。
- 字体策略：Manrope 做正文与 UI，Fraunces（opsz 可变衬线）做 display 与少量装饰，Noto Serif SC 给中文衬线场景。衬线不是摆设，要在合适处显出"书"的味道。
- 主题：双主题随系统切换。深色不是"程序员深色"，是"夜读灯下的暖深色"——`#141210` 背景、奶米色字。
- Color strategy: **Restrained**——暖中性 + 一个 clay 主色（≤10%），amber 仅用于评分/星标。其余 indigo / leaf / rose 是极少量的语义点缀。
- 圆角偏紧（≤12px），表面用半透明叠层（rgba paper），边缘用低对比 border-edge。
- 沉浸式 PWA：状态栏融背景、`viewport-fit=cover`、不要 fixed nav，所有导航元素留在文档流里。

**正面参照**：当前已实现的整体风格就是基线。新设计要与之共生而非另立门户。

**反面参照（绝对避开）**：
- 大量渐变（`background-clip: text` 文字渐变、铺满屏的多色 gradient hero、卡片彩色描边等一律不要）。
- Emoji。任何场景都不要用 emoji 替代图标或情绪表达；用 lucide 图标 + 文字。
- SaaS dashboard 套路（指标大字 + 小标 + 渐变饰条 + 一排同尺寸卡片）。
- 冷灰科技风、navy + gold 金融风、霓虹赛博风。
- glassmorphism / 大块磨砂当主装饰。
- 弹跳/橡皮筋类入场动效。

### Design Principles

1. **Quiet by default.** 视觉权重靠不动声色的对比建立——字号、字重、留白、衬线/无衬线切换。不靠加色、加边框、加阴影喊话。
2. **Tinted, never neutral.** 没有 `#fff`、没有 `#000`、没有冷灰。任何中性色都向暖棕家族微调，连 skeleton、border 都要带一点 paper 的体温。
3. **Editorial over UI-y.** 在能用版式语言（标尺、首字、段落引导、衬线小标）解决问题的地方，优先用版式语言，少用控件化包装。卡片是懒答案。
4. **Touch the chrome.** 把状态栏、滚动条、外缘留白都纳入设计——它们和内容是一体的，不是浏览器残留。
5. **Persist user state.** 慢产品要尊重用户位置感：搜索滚动条、横向滚动条、tab 状态、表单草稿，能保留就保留，不让用户重新开始。

### Hard Bans (visual)

- 渐变除非作为极轻微（低对比度、单一色相内）的氛围层，否则不用。
- Emoji（含装饰性 emoji 与"emoji 当 icon"）。
- 同尺寸卡片网格当唯一信息架构。
- 强烈入场动画、bounce/elastic、自动轮播。
- 纯白 / 纯黑 / 冷灰中性色。
- 浮动固定 nav 栏（fixed/sticky 全宽底部 tab bar 之类）。
