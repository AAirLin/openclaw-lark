---
name: feishu-approval
description: |
  飞书审批管理工具集。包含审批实例管理、审批任务管理（通过、拒绝、转交）。
---

# 飞书审批管理 (feishu-approval)

## 执行前必读

- **安全规则**：在执行 approve（通过）或 reject（拒绝）操作之前，**必须先向用户确认**。这些操作不可撤销。
- **ID 格式**：用户 `ou_...`（open_id），审批定义 `approval_code`，审批实例 `instance_code`
- **用户身份**：所有操作以当前用户身份执行（User Access Token），无需手动传入 user_id
- **instance_id 即 instance_code**：工具参数中的 `instance_id` 对应飞书 API 中的 `instance_code`

---

## 快速索引：意图 -> 工具 -> 必填参数

| 用户意图 | 工具 | action | 必填参数 | 常用可选 |
|---------|------|--------|---------|---------|
| 查看审批实例详情 | feishu_approval_instance | get | instance_id | - |
| 查询审批实例列表 | feishu_approval_instance | list | approval_code | start_time, end_time, page_size |
| 撤回审批 | feishu_approval_instance | cancel | approval_code, instance_id | - |
| 抄送审批 | feishu_approval_instance | cc | approval_code, instance_id, cc_user_ids | comment |
| 查询我的待审批任务 | feishu_approval_task | query | - | topic, page_size |
| 审批通过 | feishu_approval_task | approve | approval_code, instance_id, task_id | comment |
| 审批拒绝 | feishu_approval_task | reject | approval_code, instance_id, task_id | comment |
| 转交审批任务 | feishu_approval_task | transfer | approval_code, instance_id, task_id, transfer_user_id | comment |

---

## 核心约束

### 1. approve / reject 必须用户确认

**绝对不能**在未获得用户明确确认的情况下调用 approve 或 reject。这些操作会直接影响审批流程，且不可撤回。

典型流程：
1. 用户说"帮我通过这个审批"
2. 先用 `feishu_approval_instance.get` 获取实例详情
3. 向用户展示审批内容摘要
4. 明确询问"确认通过此审批吗？"
5. 用户确认后才执行 `feishu_approval_task.approve`

### 2. task.query 的 topic 参数

| topic 值 | 含义 |
|----------|------|
| `"1"` | 待我审批（默认） |
| `"2"` | 我发起的 |
| `"3"` | 抄送我的 |
| `"17"` | 我已完成的 |
| `"18"` | 全部 |

### 3. 获取审批三要素

大部分操作需要三个 ID：`approval_code`、`instance_id`、`task_id`。

获取流程：
1. `feishu_approval_task.query`（topic="1"）获取待审批列表，返回中包含 `definition_code`（即 approval_code）、`process_id`（即 instance_code/instance_id）、`task_id`
2. 或者用户直接提供这些 ID

### 4. 撤回 (cancel) 仅限发起人

只有审批实例的发起人才能撤回。对非本人发起的实例调用 cancel 会报错。

---

## 使用场景示例

### 场景 1: 查看我的待审批任务

```json
{
  "action": "query",
  "topic": "1"
}
```

### 场景 2: 查看审批实例详情

```json
{
  "action": "get",
  "instance_id": "xxx"
}
```

### 场景 3: 通过审批（需先确认）

```json
{
  "action": "approve",
  "approval_code": "xxx",
  "instance_id": "xxx",
  "task_id": "xxx",
  "comment": "同意"
}
```

### 场景 4: 拒绝审批（需先确认）

```json
{
  "action": "reject",
  "approval_code": "xxx",
  "instance_id": "xxx",
  "task_id": "xxx",
  "comment": "信息不完整，请补充后重新提交"
}
```

### 场景 5: 转交审批任务

```json
{
  "action": "transfer",
  "approval_code": "xxx",
  "instance_id": "xxx",
  "task_id": "xxx",
  "transfer_user_id": "ou_target_user"
}
```

### 场景 6: 抄送审批给同事

```json
{
  "action": "cc",
  "approval_code": "xxx",
  "instance_id": "xxx",
  "cc_user_ids": ["ou_aaa", "ou_bbb"],
  "comment": "请关注此审批"
}
```

---

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| 撤回失败 | 不是审批发起人 | 仅发起人可撤回自己发起的审批 |
| 审批通过/拒绝失败 | 不是当前审批节点的审批人 | 确认任务分配给当前用户 |
| 查不到待审批任务 | topic 参数不对 | 默认 topic="1" 查待审批，改 "18" 查全部 |
| user_id 错误 | 系统自动获取失败 | 确保从飞书会话中发起操作 |

---

## 背景知识

### 审批模型

```
审批定义 (Approval Definition)
  └── 审批实例 (Instance)  — 一次具体的审批请求
       └── 审批任务 (Task)  — 分配给审批人的待办
```

### 审批流程生命周期

1. **发起**: 用户创建审批实例（instance），填写表单
2. **审批中**: 按流程节点分配任务（task）给审批人
3. **审批人操作**: 通过 / 拒绝 / 转交
4. **结束**: 审批通过 / 被拒绝 / 被撤回

### 实例状态说明

| 状态 | 含义 |
|------|------|
| `PENDING` | 审批中 |
| `APPROVED` | 已通过 |
| `REJECTED` | 已拒绝 |
| `CANCELED` | 已撤回 |
| `DELETED` | 已删除 |

### 任务状态说明

| 状态 | 含义 |
|------|------|
| `PENDING` | 待处理 |
| `APPROVED` | 已通过 |
| `REJECTED` | 已拒绝 |
| `TRANSFERRED` | 已转交 |
| `DONE` | 已完成 |
