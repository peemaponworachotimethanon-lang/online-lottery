'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { InlineAlert } from '@/components/ui/feedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { broadcastNotificationAction } from '@/server/actions/admin-actions';

/**
 * Bulk notification.
 *
 * The action enqueues a job rather than writing every notification inline, so the
 * request returns immediately regardless of how many recipients there are.
 */
export function BroadcastForm({ canSend }: { canSend: boolean }) {
  const [type, setType] = React.useState<'system' | 'promotion'>('system');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [pending, setPending] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    const result = await broadcastNotificationAction({ type, title, body });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`ส่งเข้าคิวแล้ว · ผู้รับ ${result.data.queued} คน`);
    setTitle('');
    setBody('');
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {!canSend ? (
        <InlineAlert tone="warning">
          บัญชีของคุณไม่มีสิทธิ์ settings.manage จึงส่งประกาศไม่ได้ (ต้องเป็น superadmin)
        </InlineAlert>
      ) : null}

      <Field label="ประเภท" htmlFor="broadcast-type">
        <Select value={type} onValueChange={(value) => setType(value as 'system' | 'promotion')}>
          <SelectTrigger id="broadcast-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">ประกาศระบบ</SelectItem>
            <SelectItem value="promotion">โปรโมชัน</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="หัวข้อ" htmlFor="broadcast-title">
        <Input
          id="broadcast-title"
          value={title}
          maxLength={80}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field label="เนื้อหา" htmlFor="broadcast-body">
        <Textarea
          id="broadcast-body"
          value={body}
          maxLength={400}
          onChange={(event) => setBody(event.target.value)}
        />
      </Field>

      <Button type="submit" disabled={!canSend || pending || title.length < 3 || body.length < 3}>
        <Send /> {pending ? 'กำลังส่ง…' : 'ส่งประกาศ'}
      </Button>
    </form>
  );
}
