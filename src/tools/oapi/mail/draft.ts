/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * feishu_mail_draft tool -- Manage Feishu mail drafts.
 *
 * Actions: create, get, update, send, delete, list
 *
 * Uses the Feishu Mail API:
 *   - create: POST /open-apis/mail/v1/mailboxes/:user_mailbox_id/messages/draft/create
 *   - get:    GET  /open-apis/mail/v1/mailboxes/:user_mailbox_id/messages/draft/:draft_id
 *   - update: PUT  /open-apis/mail/v1/mailboxes/:user_mailbox_id/messages/draft/:draft_id
 *   - send:   POST /open-apis/mail/v1/mailboxes/:user_mailbox_id/messages/draft/:draft_id/send
 *   - delete: DEL  /open-apis/mail/v1/mailboxes/:user_mailbox_id/messages/draft/:draft_id
 *   - list:   GET  /open-apis/mail/v1/mailboxes/:user_mailbox_id/messages/draft
 */

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { assertLarkOk, createToolContext, handleInvokeErrorWithAutoAuth, json, registerTool } from '../helpers';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const EmailAddress = Type.Object({
  email: Type.String({ description: 'Email address' }),
});

const FeishuMailDraftSchema = Type.Union([
  // CREATE
  Type.Object({
    action: Type.Literal('create'),
    user_mailbox_id: Type.Optional(
      Type.String({
        description: 'User mailbox ID (default: "me")',
      }),
    ),
    to: Type.Optional(
      Type.Array(EmailAddress, {
        description: 'List of recipient email addresses',
      }),
    ),
    subject: Type.Optional(
      Type.String({
        description: 'Draft subject line',
      }),
    ),
    body_html: Type.Optional(
      Type.String({
        description: 'Draft body in HTML format',
      }),
    ),
    body_plain_text: Type.Optional(
      Type.String({
        description: 'Draft body in plain text format',
      }),
    ),
  }),

  // GET
  Type.Object({
    action: Type.Literal('get'),
    user_mailbox_id: Type.Optional(
      Type.String({
        description: 'User mailbox ID (default: "me")',
      }),
    ),
    draft_id: Type.String({
      description: 'Draft ID to retrieve',
    }),
  }),

  // UPDATE
  Type.Object({
    action: Type.Literal('update'),
    user_mailbox_id: Type.Optional(
      Type.String({
        description: 'User mailbox ID (default: "me")',
      }),
    ),
    draft_id: Type.String({
      description: 'Draft ID to update',
    }),
    to: Type.Optional(
      Type.Array(EmailAddress, {
        description: 'Updated list of recipient email addresses',
      }),
    ),
    subject: Type.Optional(
      Type.String({
        description: 'Updated subject line',
      }),
    ),
    body_html: Type.Optional(
      Type.String({
        description: 'Updated body in HTML format',
      }),
    ),
  }),

  // SEND
  Type.Object({
    action: Type.Literal('send'),
    user_mailbox_id: Type.Optional(
      Type.String({
        description: 'User mailbox ID (default: "me")',
      }),
    ),
    draft_id: Type.String({
      description: 'Draft ID to send',
    }),
  }),

  // DELETE
  Type.Object({
    action: Type.Literal('delete'),
    user_mailbox_id: Type.Optional(
      Type.String({
        description: 'User mailbox ID (default: "me")',
      }),
    ),
    draft_id: Type.String({
      description: 'Draft ID to delete',
    }),
  }),

  // LIST
  Type.Object({
    action: Type.Literal('list'),
    user_mailbox_id: Type.Optional(
      Type.String({
        description: 'User mailbox ID (default: "me")',
      }),
    ),
    page_size: Type.Optional(
      Type.Number({
        description: 'Number of drafts to return per page',
      }),
    ),
    page_token: Type.Optional(
      Type.String({
        description: 'Pagination token for next page',
      }),
    ),
  }),
]);

// ---------------------------------------------------------------------------
// Params type
// ---------------------------------------------------------------------------

type FeishuMailDraftParams =
  | {
      action: 'create';
      user_mailbox_id?: string;
      to?: Array<{ email: string }>;
      subject?: string;
      body_html?: string;
      body_plain_text?: string;
    }
  | { action: 'get'; user_mailbox_id?: string; draft_id: string }
  | {
      action: 'update';
      user_mailbox_id?: string;
      draft_id: string;
      to?: Array<{ email: string }>;
      subject?: string;
      body_html?: string;
    }
  | { action: 'send'; user_mailbox_id?: string; draft_id: string }
  | { action: 'delete'; user_mailbox_id?: string; draft_id: string }
  | {
      action: 'list';
      user_mailbox_id?: string;
      page_size?: number;
      page_token?: string;
    };

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFeishuMailDraftTool(api: OpenClawPluginApi) {
  if (!api.config) return;
  const cfg = api.config;

  const { toolClient, log } = createToolContext(api, 'feishu_mail_draft');

  registerTool(
    api,
    {
      name: 'feishu_mail_draft',
      label: 'Feishu Mail Draft',
      description:
        '【以用户身份】飞书邮件草稿管理工具。创建、编辑、发送、删除草稿。' +
        'Actions: create（创建草稿）, get（获取草稿）, update（更新草稿）, send（发送草稿）, delete（删除草稿）, list（列出草稿）。' +
        '⚠️ 注意：草稿不等于已发送邮件，发送草稿前必须经用户确认。',
      parameters: FeishuMailDraftSchema,
      async execute(_toolCallId: string, params: unknown) {
        const p = params as FeishuMailDraftParams;
        try {
          const client = toolClient();
          const mailboxId = p.user_mailbox_id || 'me';

          switch (p.action) {
            // -----------------------------------------------------------------
            // CREATE DRAFT
            // -----------------------------------------------------------------
            case 'create': {
              log.info(`create: mailbox=${mailboxId}`);

              const res = await client.invokeByPath(
                'feishu_mail_draft.create',
                `/open-apis/mail/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/draft/create`,
                {
                  method: 'POST',
                  body: {
                    to: p.to,
                    subject: p.subject,
                    body_html: p.body_html,
                    body_plain_text: p.body_plain_text,
                  },
                  as: 'user',
                },
              );
              assertLarkOk(res);

              log.info(`create: draft created successfully`);

              return json({
                success: true,
                draft: res.data,
              });
            }

            // -----------------------------------------------------------------
            // GET DRAFT
            // -----------------------------------------------------------------
            case 'get': {
              if (!p.draft_id) {
                return json({
                  error: "draft_id is required for 'get' action",
                });
              }

              log.info(`get: mailbox=${mailboxId}, draft_id=${p.draft_id}`);

              const res = await client.invokeByPath(
                'feishu_mail_draft.get',
                `/open-apis/mail/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/draft/${encodeURIComponent(p.draft_id)}`,
                {
                  method: 'GET',
                  as: 'user',
                },
              );
              assertLarkOk(res);

              log.info(`get: retrieved draft ${p.draft_id}`);

              return json({
                draft: res.data,
              });
            }

            // -----------------------------------------------------------------
            // UPDATE DRAFT
            // -----------------------------------------------------------------
            case 'update': {
              if (!p.draft_id) {
                return json({
                  error: "draft_id is required for 'update' action",
                });
              }

              log.info(`update: mailbox=${mailboxId}, draft_id=${p.draft_id}`);

              const res = await client.invokeByPath(
                'feishu_mail_draft.update',
                `/open-apis/mail/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/draft/${encodeURIComponent(p.draft_id)}`,
                {
                  method: 'PUT',
                  body: {
                    to: p.to,
                    subject: p.subject,
                    body_html: p.body_html,
                  },
                  as: 'user',
                },
              );
              assertLarkOk(res);

              log.info(`update: updated draft ${p.draft_id}`);

              return json({
                success: true,
                draft: res.data,
              });
            }

            // -----------------------------------------------------------------
            // SEND DRAFT
            // -----------------------------------------------------------------
            case 'send': {
              if (!p.draft_id) {
                return json({
                  error: "draft_id is required for 'send' action",
                });
              }

              log.info(`send: mailbox=${mailboxId}, draft_id=${p.draft_id}`);

              const res = await client.invokeByPath(
                'feishu_mail_draft.send',
                `/open-apis/mail/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/draft/${encodeURIComponent(p.draft_id)}/send`,
                {
                  method: 'POST',
                  as: 'user',
                },
              );
              assertLarkOk(res);

              log.info(`send: draft ${p.draft_id} sent successfully`);

              return json({
                success: true,
                message: res.data,
              });
            }

            // -----------------------------------------------------------------
            // DELETE DRAFT
            // -----------------------------------------------------------------
            case 'delete': {
              if (!p.draft_id) {
                return json({
                  error: "draft_id is required for 'delete' action",
                });
              }

              log.info(`delete: mailbox=${mailboxId}, draft_id=${p.draft_id}`);

              const res = await client.invokeByPath(
                'feishu_mail_draft.delete',
                `/open-apis/mail/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/draft/${encodeURIComponent(p.draft_id)}`,
                {
                  method: 'DELETE',
                  as: 'user',
                },
              );
              assertLarkOk(res);

              log.info(`delete: deleted draft ${p.draft_id}`);

              return json({
                success: true,
                draft_id: p.draft_id,
              });
            }

            // -----------------------------------------------------------------
            // LIST DRAFTS
            // -----------------------------------------------------------------
            case 'list': {
              log.info(
                `list: mailbox=${mailboxId}, page_size=${p.page_size ?? 'default'}, page_token=${p.page_token ?? 'none'}`,
              );

              const res = await client.invokeByPath(
                'feishu_mail_draft.list',
                `/open-apis/mail/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/draft`,
                {
                  method: 'GET',
                  query: {
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
              const drafts = data?.items ?? [];
              log.info(`list: returned ${drafts.length} drafts`);

              return json({
                drafts,
                has_more: data?.has_more ?? false,
                page_token: data?.page_token,
              });
            }
          }
        } catch (err) {
          return await handleInvokeErrorWithAutoAuth(err, cfg);
        }
      },
    },
    { name: 'feishu_mail_draft' },
  );
}
