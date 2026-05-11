# Insight Agent Blind Evaluation App

纯静态盲评工具。评分员输入密码后打开网页，阅读匿名答案（A/B/C/D）并打分，评分结果存在浏览器 localStorage，完成后导出 JSON/CSV 发给评测负责人。

## 部署地址

- 中文评分：https://yexin-li.github.io/insight-eval/?lang=zh
- 英文评分：https://yexin-li.github.io/insight-eval/?lang=en

默认访问密码：`insight2026`（可在 `index.html` 顶部的 `ACCESS_PASSWORD` 修改）

## 参与评分的模型（4个）

| 模型 | 答案来源目录 |
|------|-------------|
| Opus 4.7 | `cc_opus47/{ID}_{lang}_answer.md` |
| GPT 5.5 | `GPT55/{ID}_{lang}_answer.md` |
| Gemini 3.1 Pro | `Gemini31Pro/{ID}_{lang}_answer.md` |
| Insight Agent | `insight agent eval_results_export_LIST_EV_B0509/{ID}_{lang}_B0509_GEN000.md` |

每道题的 A/B/C/D 分配随机（seed=42），中英文版本映射完全一致。

## 重新生成数据

答案有更新时，运行（同时生成中英文，保证映射一致）：

```bash
cd eval-app
python3 generate_eval_data.py --lang both
```

匿名化（默认）生成 A/B/C/D 标签；如需查看模型名：

```bash
python3 generate_eval_data.py --lang both --no-anonymize
```

然后推送到 GitHub：

```bash
git add data_zh.js data_en.js && git commit -m "update data" && git push
```

## 重要：不要上传/分享给评分员的文件

- `_answer_key_zh.json` — 中文版 A/B/C/D → 模型名映射
- `_answer_key_en.json` — 英文版 A/B/C/D → 模型名映射
- `generate_eval_data.py` — 数据生成脚本
- `merge_results.py` — 结果汇总脚本

## 评分员操作流程

1. 打开链接，输入密码进入
2. 填写顶部 **Reviewer** 姓名（会记住，之后不用再填）
3. 从下拉菜单选择题目，题目旁边会显示对应的广告账户名
4. 阅读 Answer A / B / C / D（模型身份不公开）
5. 点击 📋 评分标准参考 查看 G2/G4/G5 打分说明
6. 在右侧表单中为每个答案打分（1-5 或 N/A），填写打分理由
7. 评分自动保存到浏览器
8. 全部完成后点击 **JSON** 或 **CSV** 导出，发给评测负责人

## 多评分员汇总流程

1. 收集所有评分员导出的 CSV 文件
2. 在本地运行（需要 `_answer_key_*.json` 文件）：

```bash
# 中文评分员结果
python3 merge_results.py --lang zh --results rater1_zh.csv rater2_zh.csv

# 英文评分员结果
python3 merge_results.py --lang en --results rater1_en.csv rater2_en.csv
```

输出 `merged_results_zh.csv` / `merged_results_en.csv`，自动把 A/B/C/D 还原为模型名，并打印每个模型的 G2/G4/G5 平均分。
