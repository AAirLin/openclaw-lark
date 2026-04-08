---
name: feishu-minutes
description: |
  飞书妙记查询工具。获取妙记基础信息（标题、封面、时长）和统计数据。
---

# 飞书妙记 (feishu-minutes)

## 执行前必读

- **用户身份**：所有操作以当前用户身份执行（User Access Token）
- **minute_token**：妙记的唯一标识，可从妙记 URL 中提取
- **关联会议**：妙记通常由视频会议录制生成，使用 `feishu_vc_meeting_record` 查询会议详情

---

## 从 URL 提取 minute_token

飞书妙记的 URL 格式通常为：
```
https://meetings.feishu.cn/minutes/<minute_token>
```

例如：`https://meetings.feishu.cn/minutes/obcnq3b9p5172r9j9l85jg55` 中的 `minute_token` 为 `obcnq3b9p5172r9j9l85jg55`。

---

## 快速索引：意图 -> 工具 -> 必填参数

| 用户意图 | 工具 | action | 必填参数 | 常用可选 |
|---------|------|--------|---------|---------|
| 获取妙记信息 | feishu_minutes_minute | get | minute_token | - |
| 获取妙记统计 | feishu_minutes_minute | statistics | minute_token | - |

---

## 使用场景示例

### 场景 1: 查看妙记基础信息

```json
{
  "action": "get",
  "minute_token": "obcnq3b9p5172r9j9l85jg55"
}
```

返回信息包括：标题、封面图、时长、创建时间等。

### 场景 2: 查看妙记统计数据

```json
{
  "action": "statistics",
  "minute_token": "obcnq3b9p5172r9j9l85jg55"
}
```

返回信息包括：观看人数、观看时长等统计。

---

## 与其他工具的关联

- **视频会议 (VC)**：妙记通常来自视频会议的录制，使用 `feishu_vc_meeting_record` 搜索和查看会议记录
- **日历 (Calendar)**：会议日程可通过 `feishu_calendar_event` 查看

---

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| minute_token 无效 | URL 解析错误或妙记已删除 | 检查 URL 格式，确认妙记是否还存在 |
| 无权限访问 | 当前用户不是妙记的参与者 | 确认用户有查看该妙记的权限 |
| 统计数据为空 | 妙记刚创建，尚无统计 | 等待一段时间后再查询 |
