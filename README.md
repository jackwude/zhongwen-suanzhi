# 中文算纸 MVP

中文友好的笔记式计算器（Web）：左边写说明 + 数字/算式，右边实时出结果，底部自动总计。

对标 Soulver 手机「点菜记账纸」体验。

## 快速开始

```bash
cd ~/.hermes/workspace/projects/zhongwen-suanzhi
npm install
npm run dev
```

测试：

```bash
npm test
```

构建：

```bash
npm run build
npm run preview
```

## 能做什么

- 混写抽数：`蒸蒸日上 128`、`锅边馍 小 15`
- 四则运算与括号：`1+2*3`
- 变量：`单价 = 89` / `单价 * 数量`
- 行引用：`#1+#2`（只能引用更小行号）
- 中文：`3万`、`1.2亿`、`打八折` / `打8折`、`8.5折`
- 百分比（写死语义）：
  - `50 + 10%` → `55`
  - `50 * 10%` → `5`
- 底部**总计**（所有有效数值行之和，**含赋值行**）
- `localStorage` 自动保存

## 不用什么

- 不用 `eval` / `new Function`
- 求值内核：**开源 [mathjs](https://mathjs.org/)**（Apache-2.0）
- 中文预处理与多行编排：自研

## 技术栈

Vite + React + TypeScript + mathjs + Vitest

编辑器：textarea + 镜像结果列（MVP 优先稳定对齐；未强绑 CodeMirror）

## 语义说明

| 输入 | 结果 |
|------|------|
| `菜名 128` | 128（取可计算数字；多数字无运算符取最后一个） |
| `打八折` / `N折` | × N/10 |
| `a + N%` | a × (1 + N/100) |
| `a * N%` | a × (N/100) |
| 赋值行 | 右栏显示值，**计入总计** |

## 已知限制（MVP）

- 无多文档、无单位/货币/满减模板
- 无小程序 / 账号同步
- 数字 token 级蓝色高亮未做（结果列已对齐 Soulver 右栏）
- 中文数字折扣仅支持个位（八折等），不支持「三十」

## 文档

- 产品/计划：`~/.hermes/workspace/docs/zhongwen-suanzhi/`

## License

自研代码暂未开源发布；第三方依赖见各自协议。
