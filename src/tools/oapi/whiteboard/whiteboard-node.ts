/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * feishu_whiteboard_node tool -- 飞书画板节点管理
 *
 * Actions:
 *   create - 创建画板节点（上传 DSL 数据到画板）
 *   list   - 查询画板节点列表
 *
 * 使用以下 SDK 接口:
 * - sdk.board.v1.whiteboardNode.create - 创建画板节点
 * - sdk.board.v1.whiteboardNode.list   - 查询画板节点列表
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { assertLarkOk, createToolContext, handleInvokeErrorWithAutoAuth, json, registerTool } from '../helpers';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const WhiteboardNodeSchema = Type.Union([
  // CREATE
  Type.Object({
    action: Type.Literal('create'),
    whiteboard_id: Type.String({
      description: '画板 Token（必填）。可从画板 URL 或文档中的 <whiteboard token="XXX"/> 获取',
    }),
    nodes: Type.String({
      description:
        '节点数据的 JSON 字符串（必填）。来自 whiteboard-cli --to openapi 的输出，' +
        '包含要创建的节点数组',
    }),
  }),

  // LIST
  Type.Object({
    action: Type.Literal('list'),
    whiteboard_id: Type.String({
      description: '画板 Token（必填）',
    }),
  }),
]);

// ---------------------------------------------------------------------------
// Params type
// ---------------------------------------------------------------------------

type WhiteboardNodeParams =
  | { action: 'create'; whiteboard_id: string; nodes: string }
  | { action: 'list'; whiteboard_id: string };

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFeishuWhiteboardNodeTool(api: OpenClawPluginApi) {
  if (!api.config) return;
  const cfg = api.config;

  const { toolClient, log } = createToolContext(api, 'feishu_whiteboard_node');

  registerTool(
    api,
    {
      name: 'feishu_whiteboard_node',
      label: 'Feishu Whiteboard Node',
      description:
        '【以用户身份】飞书画板节点管理工具。创建画板节点（上传 DSL 数据到画板）、查询画板节点列表。' +
        'Actions: create（创建节点，上传 whiteboard-cli --to openapi 输出的 JSON 数据）, list（查询节点列表）。',
      parameters: WhiteboardNodeSchema,
      async execute(_toolCallId: string, params: unknown) {
        const p = params as WhiteboardNodeParams;
        try {
          const client = toolClient();

          switch (p.action) {
            // -----------------------------------------------------------------
            // CREATE NODES
            // -----------------------------------------------------------------
            case 'create': {
              if (!p.whiteboard_id) {
                return json({
                  error: "whiteboard_id is required for 'create' action",
                });
              }
              if (!p.nodes) {
                return json({
                  error: "nodes is required for 'create' action",
                });
              }

              let nodesData: any;
              try {
                nodesData = JSON.parse(p.nodes);
              } catch {
                return json({
                  error: 'nodes must be a valid JSON string',
                });
              }

              log.info(`create: whiteboard_id=${p.whiteboard_id}`);

              const res: any = await client.invoke(
                'feishu_whiteboard_node.create',
                (sdk, opts) =>
                  (sdk.board.v1.whiteboardNode as any).create(
                    {
                      path: { whiteboard_id: p.whiteboard_id },
                      data: nodesData,
                    },
                    opts,
                  ),
                { as: 'user' },
              );
              assertLarkOk(res);

              log.info(`create: nodes created on whiteboard ${p.whiteboard_id}`);

              return json({
                success: true,
                whiteboard_id: p.whiteboard_id,
                data: res.data,
              });
            }

            // -----------------------------------------------------------------
            // LIST NODES
            // -----------------------------------------------------------------
            case 'list': {
              if (!p.whiteboard_id) {
                return json({
                  error: "whiteboard_id is required for 'list' action",
                });
              }

              log.info(`list: whiteboard_id=${p.whiteboard_id}`);

              const res: any = await client.invoke(
                'feishu_whiteboard_node.list',
                (sdk, opts) =>
                  (sdk.board.v1.whiteboardNode as any).list(
                    {
                      path: { whiteboard_id: p.whiteboard_id },
                    },
                    opts,
                  ),
                { as: 'user' },
              );
              assertLarkOk(res);

              const nodes = res.data?.nodes ?? res.data?.items ?? [];
              log.info(`list: returned ${Array.isArray(nodes) ? nodes.length : 'unknown'} nodes`);

              return json({
                whiteboard_id: p.whiteboard_id,
                nodes: res.data,
              });
            }
          }
        } catch (err) {
          return await handleInvokeErrorWithAutoAuth(err, cfg);
        }
      },
    },
    { name: 'feishu_whiteboard_node' },
  );
}
