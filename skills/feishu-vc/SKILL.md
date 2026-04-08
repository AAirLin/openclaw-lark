---
name: feishu-vc
description: |
  飞书视频会议记录查询工具。搜索会议记录、获取会议详情和参会人信息。
---

# 飞书视频会议 (feishu-vc)

## 执行前必读

- **用户身份**：所有操作以当前用户身份执行（User Access Token）
- **时间格式**：start_time / end_time 使用 Unix 时间戳（秒）
- **关联妙记**：如果会议有 AI 生成的纪要/转写，请使用 `feishu_minutes_minute` 工具查询妙记内容

---

## 快速索引：意图 -> 工具 -> 必填参数

| 用户意图 | 工具 | action | 必填参数 | 常用可选 |
|---------|------|--------|---------|---------|
| 搜索会议记录 | feishu_vc_meeting_record | search | - | keyword, start_time, end_time, page_size |
| 获取会议详情 | feishu_vc_meeting_record | get | meeting_record_id | - |

---

## 使用场景示例

### 场景 1: 搜索最近的会议记录

```json
{
  "action": "search",
  "keyword": "项目评审"
}
```

### 场景 2: 按时间范围搜索

```json
{
  "action": "search",
  "start_time": "1711929600",
  "end_time": "1712016000"
}
```

### 场景 3: 获取会议详情

```json
{
  "action": "get",
  "meeting_record_id": "xxx"
}
```

---

## 与其他工具的关联

- **妙记 (Minutes)**：会议的 AI 转写和纪要存储在妙记中，使用 `feishu_minutes_minute` 工具查看妙记的标题、时长、统计等信息
- **日历 (Calendar)**：会议通常与日历日程关联，可通过 `feishu_calendar_event` 查看日程详情

---

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| 搜索无结果 | 时间范围不对或关键词不匹配 | 扩大时间范围，使用更宽泛的关键词 |
| 获取详情失败 | meeting_record_id 无效 | 先通过 search 获取有效 ID |
| 没有会议笔记 | 会议未开启录制/转写 | 检查会议设置，妙记需要开启录制功能 |
