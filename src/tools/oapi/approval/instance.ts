/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * feishu_approval_instance tool -- Manage Feishu approval instances.
 *
 * Actions: get, list, cancel, cc
 *
 * Uses the Feishu Approval API:
 *   - get:    GET  /open-apis/approval/v4/instances/:instance_id
 *   - list:   POST /open-apis/approval/v4/instances/query
 *   - cancel: POST /open-apis/approval/v4/instances/cancel
 *   - cc:     POST /open-apis/approval/v4/instances/cc
 */

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { json, createToolContext, assertLarkOk, handleInvokeErrorWithAutoAuth, registerTool } from '../helpers';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const FeishuApprovalInstanceSchema = Type.Union([
  // GET
  Type.Object({
    action: Type.Literal('get'),
    instance_id: Type.String({
      description: 'Approval instance ID (instance_code)',
    }),
  }),

  // LIST
  Type.Object({
    action: Type.Literal('list'),
    approval_code: Type.String({
      description: 'Approval definition code to filter instances',
    }),
    start_time: Type.Optional(
      Type.String({
        description: 'Start time filter (timestamp in milliseconds)',
      }),
    ),
    end_time: Type.Optional(
      Type.String({
        description: 'End time filter (timestamp in milliseconds)',
      }),
    ),
    page_size: Type.Optional(
      Type.Number({
        description: 'Number of instances to return per page (default: 10, max: 100)',
      }),
    ),
    page_token: Type.Optional(
      Type.String({
        description: 'Pagination token for next page',
      }),
    ),
  }),

  // CANCEL
  Type.Object({
    action: Type.Literal('cancel'),
    approval_code: Type.String({
      description: 'Approval definition code',
    }),
    instance_id: Type.String({
      description: 'Approval instance ID (instance_code) to cancel',
    }),
  }),

  // CC
  Type.Object({
    action: Type.Literal('cc'),
    approval_code: Type.String({
      description: 'Approval definition code',
    }),
    instance_id: Type.String({
      description: 'Approval instance ID (instance_code)',
    }),
    cc_user_ids: Type.Array(Type.String(), {
      description: 'List of user open_ids to CC',
    }),
    comment: Type.Optional(
      Type.String({
        description: 'Optional comment for the CC notification',
      }),
    ),
  }),
]);

// ---------------------------------------------------------------------------
// Params type
// ---------------------------------------------------------------------------

type FeishuApprovalInstanceParams =
  | { action: 'get'; instance_id: string }
  | {
      action: 'list';
      approval_code: string;
      start_time?: string;
      end_time?: string;
      page_size?: number;
      page_token?: string;
    }
  | { action: 'cancel'; approval_code: string; instance_id: string }
  | {
      action: 'cc';
      approval_code: string;
      instance_id: string;
      cc_user_ids: string[];
      comment?: string;
    };

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFeishuApprovalInstanceTool(api: OpenClawPluginApi) {
  if (!api.config) return;
  const cfg = api.config;

  const { toolClient, log } = createToolContext(api, 'feishu_approval_instance');

  registerTool(
    api,
    {
      name: 'feishu_approval_instance',
      label: 'Feishu Approval Instance',
      description:
        '【以用户身份】飞书审批实例管理工具。查询审批实例列表、获取实例详情、撤回实例、抄送实例。' +
        'Actions: get（获取实例详情）, list（查询实例列表）, cancel（撤回实例）, cc（抄送实例）。',
      parameters: FeishuApprovalInstanceSchema,
      async execute(_toolCallId: string, params: unknown) {
        const p = params as FeishuApprovalInstanceParams;
        try {
          const client = toolClient();

          switch (p.action) {
            // -----------------------------------------------------------------
            // GET INSTANCE
            // -----------------------------------------------------------------
            case 'get': {
              if (!p.instance_id) {
                return json({
                  error: "instance_id is required for 'get' action",
                });
              }

              log.info(`get: instance_id=${p.instance_id}`);

              const res = await client.invoke(
                'feishu_approval_instance.get',
                (sdk, opts) =>
                  sdk.approval.instance.get(
                    {
                      path: { instance_id: p.instance_id },
                    },
                    opts,
                  ),
                { as: 'user' },
              );
              assertLarkOk(res);

              log.info(`get: retrieved instance ${p.instance_id}`);

              return json({
                instance: res.data,
              });
            }

            // -----------------------------------------------------------------
            // LIST INSTANCES
            // -----------------------------------------------------------------
            case 'list': {
              if (!p.approval_code) {
                return json({
                  error: "approval_code is required for 'list' action",
                });
              }

              log.info(
                `list: approval_code=${p.approval_code}, page_size=${p.page_size ?? 10}, page_token=${p.page_token ?? 'none'}`,
              );

              const res = await client.invoke(
                'feishu_approval_instance.list',
                (sdk, opts) =>
                  sdk.approval.instance.query(
                    {
                      data: {
                        approval_code: p.approval_code,
                        instance_start_time_from: p.start_time,
                        instance_start_time_to: p.end_time,
                      },
                      params: {
                        page_size: p.page_size,
                        page_token: p.page_token,
                      },
                    },
                    opts,
                  ),
                { as: 'user' },
              );
              assertLarkOk(res);

              const data = res.data as
                | {
                    count?: number;
                    instance_list?: unknown[];
                    page_token?: string;
                    has_more?: boolean;
                  }
                | undefined;
              const instances = data?.instance_list ?? [];
              log.info(`list: returned ${instances.length} instances`);

              return json({
                count: data?.count,
                instances,
                has_more: data?.has_more ?? false,
                page_token: data?.page_token,
              });
            }

            // -----------------------------------------------------------------
            // CANCEL INSTANCE
            // -----------------------------------------------------------------
            case 'cancel': {
              if (!p.approval_code || !p.instance_id) {
                return json({
                  error: "approval_code and instance_id are required for 'cancel' action",
                });
              }

              const userId = client.senderOpenId;
              if (!userId) {
                return json({
                  error: 'Cannot determine current user. Please ensure you are sending from a Feishu conversation.',
                });
              }

              log.info(`cancel: approval_code=${p.approval_code}, instance_id=${p.instance_id}`);

              const res = await client.invoke(
                'feishu_approval_instance.cancel',
                (sdk, opts) =>
                  sdk.approval.instance.cancel(
                    {
                      data: {
                        approval_code: p.approval_code,
                        instance_code: p.instance_id,
                        user_id: userId,
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

              log.info(`cancel: cancelled instance ${p.instance_id}`);

              return json({
                success: true,
                instance_id: p.instance_id,
              });
            }

            // -----------------------------------------------------------------
            // CC INSTANCE
            // -----------------------------------------------------------------
            case 'cc': {
              if (!p.approval_code || !p.instance_id || !p.cc_user_ids?.length) {
                return json({
                  error: "approval_code, instance_id, and cc_user_ids are required for 'cc' action",
                });
              }

              const ccUserId = client.senderOpenId;
              if (!ccUserId) {
                return json({
                  error: 'Cannot determine current user. Please ensure you are sending from a Feishu conversation.',
                });
              }

              log.info(
                `cc: approval_code=${p.approval_code}, instance_id=${p.instance_id}, cc_user_ids=${p.cc_user_ids.join(',')}`,
              );

              const res = await client.invoke(
                'feishu_approval_instance.cc',
                (sdk, opts) =>
                  sdk.approval.instance.cc(
                    {
                      data: {
                        approval_code: p.approval_code,
                        instance_code: p.instance_id,
                        user_id: ccUserId,
                        cc_user_ids: p.cc_user_ids,
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

              log.info(`cc: CC sent for instance ${p.instance_id} to ${p.cc_user_ids.length} users`);

              return json({
                success: true,
                instance_id: p.instance_id,
                cc_user_ids: p.cc_user_ids,
              });
            }
          }
        } catch (err) {
          return await handleInvokeErrorWithAutoAuth(err, cfg);
        }
      },
    },
    { name: 'feishu_approval_instance' },
  );
}
