/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * feishu_minutes_minute tool -- Query Feishu Minutes (妙记) metadata and statistics.
 *
 * Actions: get, statistics
 *
 * Uses the Feishu Minutes API:
 *   - get:        GET /open-apis/minutes/v1/minutes/:minute_token
 *   - statistics: GET /open-apis/minutes/v1/minutes/:minute_token/statistics
 */

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { assertLarkOk, createToolContext, handleInvokeErrorWithAutoAuth, json, registerTool } from '../helpers';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const FeishuMinutesMinuteSchema = Type.Union([
  // GET
  Type.Object({
    action: Type.Literal('get'),
    minute_token: Type.String({
      description: 'Minute token (can be extracted from the minutes URL)',
    }),
  }),

  // STATISTICS
  Type.Object({
    action: Type.Literal('statistics'),
    minute_token: Type.String({
      description: 'Minute token (can be extracted from the minutes URL)',
    }),
  }),
]);

// ---------------------------------------------------------------------------
// Params type
// ---------------------------------------------------------------------------

type FeishuMinutesMinuteParams =
  | { action: 'get'; minute_token: string }
  | { action: 'statistics'; minute_token: string };

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFeishuMinutesMinuteTool(api: OpenClawPluginApi) {
  if (!api.config) return;
  const cfg = api.config;

  const { toolClient, log } = createToolContext(api, 'feishu_minutes_minute');

  registerTool(
    api,
    {
      name: 'feishu_minutes_minute',
      label: 'Feishu Minutes',
      description:
        '【以用户身份】飞书妙记查询工具。获取妙记基础信息（标题、封面、时长）和统计数据。' +
        'Actions: get（获取妙记元信息）, statistics（获取妙记统计数据）。',
      parameters: FeishuMinutesMinuteSchema,
      async execute(_toolCallId: string, params: unknown) {
        const p = params as FeishuMinutesMinuteParams;
        try {
          const client = toolClient();

          switch (p.action) {
            // -----------------------------------------------------------------
            // GET MINUTE METADATA
            // -----------------------------------------------------------------
            case 'get': {
              if (!p.minute_token) {
                return json({
                  error: "minute_token is required for 'get' action",
                });
              }

              log.info(`get: minute_token=${p.minute_token}`);

              const res = await client.invoke(
                'feishu_minutes_minute.get',
                (sdk, opts) =>
                  sdk.minutes.v1.minute.get(
                    {
                      path: { minute_token: p.minute_token },
                    },
                    opts,
                  ),
                { as: 'user' },
              );
              assertLarkOk(res);

              log.info(`get: retrieved minute ${p.minute_token}`);

              return json({
                minute: res.data,
              });
            }

            // -----------------------------------------------------------------
            // GET MINUTE STATISTICS
            // -----------------------------------------------------------------
            case 'statistics': {
              if (!p.minute_token) {
                return json({
                  error: "minute_token is required for 'statistics' action",
                });
              }

              log.info(`statistics: minute_token=${p.minute_token}`);

              const res = await client.invoke(
                'feishu_minutes_minute.statistics',
                (sdk, opts) =>
                  sdk.minutes.v1.minuteStatistics.get(
                    {
                      path: { minute_token: p.minute_token },
                    },
                    opts,
                  ),
                { as: 'user' },
              );
              assertLarkOk(res);

              log.info(`statistics: retrieved statistics for minute ${p.minute_token}`);

              return json({
                statistics: res.data,
              });
            }
          }
        } catch (err) {
          return await handleInvokeErrorWithAutoAuth(err, cfg);
        }
      },
    },
    { name: 'feishu_minutes_minute' },
  );
}
