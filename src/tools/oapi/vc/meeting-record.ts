/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * feishu_vc_meeting_record tool -- Query Feishu video conference meeting records.
 *
 * Actions: search, get
 *
 * Uses the Feishu VC API:
 *   - search: GET /open-apis/vc/v1/meeting_records
 *   - get:    GET /open-apis/vc/v1/meeting_records/:meeting_record_id
 */

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { assertLarkOk, createToolContext, handleInvokeErrorWithAutoAuth, json, registerTool } from '../helpers';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const FeishuVcMeetingRecordSchema = Type.Union([
  // SEARCH
  Type.Object({
    action: Type.Literal('search'),
    keyword: Type.Optional(
      Type.String({
        description: 'Search keyword for meeting topic',
      }),
    ),
    start_time: Type.Optional(
      Type.String({
        description: 'Start time filter (Unix timestamp in seconds)',
      }),
    ),
    end_time: Type.Optional(
      Type.String({
        description: 'End time filter (Unix timestamp in seconds)',
      }),
    ),
    page_size: Type.Optional(
      Type.Number({
        description: 'Number of records to return per page',
      }),
    ),
    page_token: Type.Optional(
      Type.String({
        description: 'Pagination token for next page',
      }),
    ),
  }),

  // GET
  Type.Object({
    action: Type.Literal('get'),
    meeting_record_id: Type.String({
      description: 'Meeting record ID',
    }),
  }),
]);

// ---------------------------------------------------------------------------
// Params type
// ---------------------------------------------------------------------------

type FeishuVcMeetingRecordParams =
  | {
      action: 'search';
      keyword?: string;
      start_time?: string;
      end_time?: string;
      page_size?: number;
      page_token?: string;
    }
  | { action: 'get'; meeting_record_id: string };

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFeishuVcMeetingRecordTool(api: OpenClawPluginApi) {
  if (!api.config) return;
  const cfg = api.config;

  const { toolClient, log } = createToolContext(api, 'feishu_vc_meeting_record');

  registerTool(
    api,
    {
      name: 'feishu_vc_meeting_record',
      label: 'Feishu VC Meeting Record',
      description:
        '【以用户身份】飞书视频会议记录查询工具。搜索会议记录、获取会议详情。' +
        'Actions: search（搜索会议记录）, get（获取会议记录详情）。',
      parameters: FeishuVcMeetingRecordSchema,
      async execute(_toolCallId: string, params: unknown) {
        const p = params as FeishuVcMeetingRecordParams;
        try {
          const client = toolClient();

          switch (p.action) {
            // -----------------------------------------------------------------
            // SEARCH MEETING RECORDS
            // -----------------------------------------------------------------
            case 'search': {
              log.info(
                `search: keyword="${p.keyword ?? ''}", start_time=${p.start_time ?? 'none'}, end_time=${p.end_time ?? 'none'}, page_size=${p.page_size ?? 'default'}, page_token=${p.page_token ?? 'none'}`,
              );

              const res = await client.invokeByPath(
                'feishu_vc_meeting_record.search',
                '/open-apis/vc/v1/meeting_list',
                {
                  method: 'GET',
                  query: {
                    ...(p.start_time ? { start_time: p.start_time } : {}),
                    ...(p.end_time ? { end_time: p.end_time } : {}),
                    ...(p.keyword ? { meeting_no: p.keyword } : {}),
                    ...(p.page_size != null ? { page_size: String(p.page_size) } : {}),
                    ...(p.page_token ? { page_token: p.page_token } : {}),
                  },
                  as: 'user',
                },
              );
              assertLarkOk(res);

              const data = res.data as
                | {
                    items?: unknown[];
                    has_more?: boolean;
                    page_token?: string;
                  }
                | undefined;
              const records = data?.items ?? [];
              log.info(`search: returned ${records.length} meeting records`);

              return json({
                records,
                has_more: data?.has_more ?? false,
                page_token: data?.page_token,
              });
            }

            // -----------------------------------------------------------------
            // GET MEETING RECORD
            // -----------------------------------------------------------------
            case 'get': {
              if (!p.meeting_record_id) {
                return json({
                  error: "meeting_record_id is required for 'get' action",
                });
              }

              log.info(`get: meeting_record_id=${p.meeting_record_id}`);

              const res = await client.invokeByPath(
                'feishu_vc_meeting_record.get',
                `/open-apis/vc/v1/meeting_list/${encodeURIComponent(p.meeting_record_id)}`,
                {
                  method: 'GET',
                  as: 'user',
                },
              );
              assertLarkOk(res);

              log.info(`get: retrieved meeting record ${p.meeting_record_id}`);

              return json({
                record: res.data,
              });
            }
          }
        } catch (err) {
          return await handleInvokeErrorWithAutoAuth(err, cfg);
        }
      },
    },
    { name: 'feishu_vc_meeting_record' },
  );
}
