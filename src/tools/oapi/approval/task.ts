/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * feishu_approval_task tool -- Manage Feishu approval tasks.
 *
 * Actions: query, approve, reject, transfer
 *
 * Uses the Feishu Approval API:
 *   - query:    GET  /open-apis/approval/v4/tasks/query
 *   - approve:  POST /open-apis/approval/v4/tasks/approve
 *   - reject:   POST /open-apis/approval/v4/tasks/reject
 *   - transfer: POST /open-apis/approval/v4/tasks/transfer
 */

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { json, createToolContext, assertLarkOk, handleInvokeErrorWithAutoAuth, registerTool } from '../helpers';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const FeishuApprovalTaskSchema = Type.Union([
  // QUERY
  Type.Object({
    action: Type.Literal('query'),
    page_size: Type.Optional(
      Type.Number({
        description: 'Number of tasks to return per page (default: 50, max: 200)',
      }),
    ),
    page_token: Type.Optional(
      Type.String({
        description: 'Pagination token for next page',
      }),
    ),
    topic: Type.Optional(
      Type.String({
        description:
          'Task topic/category: "1" (pending approval), "2" (initiated by me), "3" (CC to me), "17" (completed by me), "18" (all)',
      }),
    ),
  }),

  // APPROVE
  Type.Object({
    action: Type.Literal('approve'),
    approval_code: Type.String({
      description: 'Approval definition code',
    }),
    instance_id: Type.String({
      description: 'Approval instance ID (instance_code)',
    }),
    task_id: Type.String({
      description: 'Task ID to approve',
    }),
    comment: Type.Optional(
      Type.String({
        description: 'Optional approval comment',
      }),
    ),
  }),

  // REJECT
  Type.Object({
    action: Type.Literal('reject'),
    approval_code: Type.String({
      description: 'Approval definition code',
    }),
    instance_id: Type.String({
      description: 'Approval instance ID (instance_code)',
    }),
    task_id: Type.String({
      description: 'Task ID to reject',
    }),
    comment: Type.Optional(
      Type.String({
        description: 'Optional rejection comment',
      }),
    ),
  }),

  // TRANSFER
  Type.Object({
    action: Type.Literal('transfer'),
    approval_code: Type.String({
      description: 'Approval definition code',
    }),
    instance_id: Type.String({
      description: 'Approval instance ID (instance_code)',
    }),
    task_id: Type.String({
      description: 'Task ID to transfer',
    }),
    transfer_user_id: Type.String({
      description: 'Target user open_id to transfer the task to',
    }),
    comment: Type.Optional(
      Type.String({
        description: 'Optional transfer comment',
      }),
    ),
  }),
]);

// ---------------------------------------------------------------------------
// Params type
// ---------------------------------------------------------------------------

type FeishuApprovalTaskParams =
  | { action: 'query'; page_size?: number; page_token?: string; topic?: string }
  | {
      action: 'approve';
      approval_code: string;
      instance_id: string;
      task_id: string;
      comment?: string;
    }
  | {
      action: 'reject';
      approval_code: string;
      instance_id: string;
      task_id: string;
      comment?: string;
    }
  | {
      action: 'transfer';
      approval_code: string;
      instance_id: string;
      task_id: string;
      transfer_user_id: string;
      comment?: string;
    };

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFeishuApprovalTaskTool(api: OpenClawPluginApi) {
  if (!api.config) return;
  const cfg = api.config;

  const { toolClient, log } = createToolContext(api, 'feishu_approval_task');

  registerTool(
    api,
    {
      name: 'feishu_approval_task',
      label: 'Feishu Approval Task',
      description:
        '【以用户身份】飞书审批任务管理工具。查询审批任务列表、审批通过、审批拒绝、转交审批任务。' +
        'Actions: query（查询我的审批任务）, approve（通过）, reject（拒绝）, transfer（转交）。',
      parameters: FeishuApprovalTaskSchema,
      async execute(_toolCallId: string, params: unknown) {
        const p = params as FeishuApprovalTaskParams;
        try {
          const client = toolClient();

          switch (p.action) {
            // -----------------------------------------------------------------
            // QUERY TASKS
            // -----------------------------------------------------------------
            case 'query': {
              const userId = client.senderOpenId;
              if (!userId) {
                return json({
                  error: 'Cannot determine current user. Please ensure you are sending from a Feishu conversation.',
                });
              }

              const topic = (p.topic ?? '1') as '1' | '2' | '3' | '17' | '18';
              log.info(`query: topic=${topic}, page_size=${p.page_size ?? 50}, page_token=${p.page_token ?? 'none'}`);

              const res = await client.invoke(
                'feishu_approval_task.query',
                (sdk, opts) =>
                  sdk.approval.task.query(
                    {
                      params: {
                        user_id: userId,
                        topic,
                        page_size: p.page_size,
                        page_token: p.page_token,
                        user_id_type: 'open_id',
                      },
                    },
                    opts,
                  ),
                { as: 'user' },
              );
              assertLarkOk(res);

              const data = res.data as
                | {
                    tasks?: unknown[];
                    page_token?: string;
                    has_more?: boolean;
                    count?: { total?: number; has_more?: boolean };
                  }
                | undefined;
              const tasks = data?.tasks ?? [];
              log.info(`query: returned ${tasks.length} tasks`);

              return json({
                tasks,
                count: data?.count,
                has_more: data?.has_more ?? false,
                page_token: data?.page_token,
              });
            }

            // -----------------------------------------------------------------
            // APPROVE TASK
            // -----------------------------------------------------------------
            case 'approve': {
              if (!p.approval_code || !p.instance_id || !p.task_id) {
                return json({
                  error: "approval_code, instance_id, and task_id are required for 'approve' action",
                });
              }

              const userId = client.senderOpenId;
              if (!userId) {
                return json({
                  error: 'Cannot determine current user. Please ensure you are sending from a Feishu conversation.',
                });
              }

              log.info(
                `approve: approval_code=${p.approval_code}, instance_id=${p.instance_id}, task_id=${p.task_id}`,
              );

              const res = await client.invoke(
                'feishu_approval_task.approve',
                (sdk, opts) =>
                  sdk.approval.task.approve(
                    {
                      data: {
                        approval_code: p.approval_code,
                        instance_code: p.instance_id,
                        user_id: userId,
                        task_id: p.task_id,
                        comment: p.comment,
                      },
                      params: {
                        user_id_type: 'open_id',
                      },
                    },
                    opts,
                  ),
                { as: 'user' },
              );
              assertLarkOk(res);

              log.info(`approve: approved task ${p.task_id}`);

              return json({
                success: true,
                task_id: p.task_id,
                instance_id: p.instance_id,
              });
            }

            // -----------------------------------------------------------------
            // REJECT TASK
            // -----------------------------------------------------------------
            case 'reject': {
              if (!p.approval_code || !p.instance_id || !p.task_id) {
                return json({
                  error: "approval_code, instance_id, and task_id are required for 'reject' action",
                });
              }

              const userId = client.senderOpenId;
              if (!userId) {
                return json({
                  error: 'Cannot determine current user. Please ensure you are sending from a Feishu conversation.',
                });
              }

              log.info(
                `reject: approval_code=${p.approval_code}, instance_id=${p.instance_id}, task_id=${p.task_id}`,
              );

              const res = await client.invoke(
                'feishu_approval_task.reject',
                (sdk, opts) =>
                  sdk.approval.task.reject(
                    {
                      data: {
                        approval_code: p.approval_code,
                        instance_code: p.instance_id,
                        user_id: userId,
                        task_id: p.task_id,
                        comment: p.comment,
                      },
                      params: {
                        user_id_type: 'open_id',
                      },
                    },
                    opts,
                  ),
                { as: 'user' },
              );
              assertLarkOk(res);

              log.info(`reject: rejected task ${p.task_id}`);

              return json({
                success: true,
                task_id: p.task_id,
                instance_id: p.instance_id,
              });
            }

            // -----------------------------------------------------------------
            // TRANSFER TASK
            // -----------------------------------------------------------------
            case 'transfer': {
              if (!p.approval_code || !p.instance_id || !p.task_id || !p.transfer_user_id) {
                return json({
                  error: "approval_code, instance_id, task_id, and transfer_user_id are required for 'transfer' action",
                });
              }

              const userId = client.senderOpenId;
              if (!userId) {
                return json({
                  error: 'Cannot determine current user. Please ensure you are sending from a Feishu conversation.',
                });
              }

              log.info(
                `transfer: approval_code=${p.approval_code}, instance_id=${p.instance_id}, task_id=${p.task_id}, transfer_to=${p.transfer_user_id}`,
              );

              const res = await client.invoke(
                'feishu_approval_task.transfer',
                (sdk, opts) =>
                  sdk.approval.task.transfer(
                    {
                      data: {
                        approval_code: p.approval_code,
                        instance_code: p.instance_id,
                        user_id: userId,
                        task_id: p.task_id,
                        transfer_user_id: p.transfer_user_id,
                        comment: p.comment,
                      },
                      params: {
                        user_id_type: 'open_id',
                      },
                    },
                    opts,
                  ),
                { as: 'user' },
              );
              assertLarkOk(res);

              log.info(`transfer: transferred task ${p.task_id} to ${p.transfer_user_id}`);

              return json({
                success: true,
                task_id: p.task_id,
                instance_id: p.instance_id,
                transfer_user_id: p.transfer_user_id,
              });
            }
          }
        } catch (err) {
          return await handleInvokeErrorWithAutoAuth(err, cfg);
        }
      },
    },
    { name: 'feishu_approval_task' },
  );
}
