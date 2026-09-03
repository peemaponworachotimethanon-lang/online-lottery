import type { Metadata } from 'next';
import { Mail, MessageCircle, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/stat-card';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { brand } from '@/config/brand';
import { FaqAccordion } from '@/features/marketing/faq';
import { formatMoney, formatRate } from '@/lib/money';
import { getServices } from '@/services/container';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'ช่วยเหลือ',
  description: 'คำถามที่พบบ่อย กติกา อัตราจ่าย เงื่อนไขการใช้งาน และช่องทางติดต่อ',
  openGraph: { title: 'ศูนย์ช่วยเหลือ', description: 'คำถามที่พบบ่อย กติกา และอัตราจ่าย' },
};

export default async function HelpPage() {
  const services = getServices();
  const betTypes = await services.repos.betTypes.list();
  const rates = await services.repos.payoutRates.list();
  const rateByCode = new Map(
    rates.filter((rate) => rate.lotteryId === null && rate.isActive).map((rate) => [rate.betTypeCode, rate]),
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-4 py-8 sm:px-6">
      <PageHeader
        title="ศูนย์ช่วยเหลือ"
        description="ทุกอย่างที่ควรรู้ก่อนเริ่มใช้งาน — ระบบนี้เป็นโหมดสาธิต ไม่มีการใช้เงินจริง"
      />

      <section id="faq" className="space-y-3 scroll-mt-20">
        <h2 className="text-lg font-semibold tracking-tight">คำถามที่พบบ่อย</h2>
        <FaqAccordion />
      </section>

      <section id="rules" className="space-y-3 scroll-mt-20">
        <h2 className="text-lg font-semibold tracking-tight">กติกาและอัตราจ่ายมาตรฐาน</h2>
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>ประเภทการแทง</TH>
                <TH align="center">จำนวนหลัก</TH>
                <TH align="right">อัตราจ่าย</TH>
                <TH align="right">ขั้นต่ำ</TH>
                <TH align="right">สูงสุด/รายการ</TH>
              </TR>
            </THead>
            <TBody>
              {betTypes.map((betType) => {
                const rate = rateByCode.get(betType.code);
                return (
                  <TR key={betType.code}>
                    <TD>
                      <span className="font-medium">{betType.nameTh}</span>
                      <span className="block text-xs text-muted-foreground">{betType.description}</span>
                    </TD>
                    <TD align="center" className="tabular">
                      {betType.digitLength}
                    </TD>
                    <TD align="right">
                      <Badge variant="gold" className="tabular">
                        x{rate ? formatRate(rate.rateMilli) : '—'}
                      </Badge>
                    </TD>
                    <TD align="right" className="tabular text-sm">
                      {formatMoney(betType.minBet)}
                    </TD>
                    <TD align="right" className="tabular text-sm">
                      {formatMoney(betType.maxBet)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
        <p className="text-xs text-muted-foreground">
          อัตราจ่ายเป็นค่ามาตรฐานของระบบ ผู้ดูแลสามารถกำหนดอัตราเฉพาะรายหวยได้
          และอัตราที่ใช้จริงจะถูกบันทึกไว้ในบิลของคุณ ณ เวลาที่แทง
        </p>
      </section>

      <section id="about" className="space-y-3 scroll-mt-20">
        <h2 className="text-lg font-semibold tracking-tight">เกี่ยวกับระบบ</h2>
        <div className="surface-card space-y-2 p-5 text-sm text-muted-foreground">
          <p>
            {brand.name} เป็นระบบสาธิต (demo) สำหรับการพัฒนา ทดสอบ และนำเสนอ
            ข้อมูลผู้ใช้ ยอดเงิน และผลรางวัลทั้งหมดเป็นข้อมูลจำลอง
          </p>
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            ไม่มีการเชื่อมต่อกับระบบชำระเงินจริง และไม่มีการรับหรือจ่ายเงินจริงในทุกกรณี
          </p>
        </div>
      </section>

      <section id="terms" className="space-y-3 scroll-mt-20">
        <h2 className="text-lg font-semibold tracking-tight">เงื่อนไขการใช้งาน</h2>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
          <li>ระบบนี้ให้บริการในโหมดสาธิตเท่านั้น ห้ามนำไปใช้รับพนันจริง</li>
          <li>ผู้ใช้ต้องรับผิดชอบความปลอดภัยของบัญชีและรหัสผ่านของตนเอง</li>
          <li>ผู้ให้บริการอาจปรับอัตราจ่าย วงเงิน หรือเวลาเปิด–ปิดรับได้ตามความเหมาะสม</li>
          <li>บิลที่ยืนยันแล้วถือเป็นที่สิ้นสุด ไม่สามารถแก้ไขหรือยกเลิกได้</li>
        </ul>
      </section>

      <section id="privacy" className="space-y-3 scroll-mt-20">
        <h2 className="text-lg font-semibold tracking-tight">นโยบายความเป็นส่วนตัว</h2>
        <p className="text-sm text-muted-foreground">
          ข้อมูลทั้งหมดในระบบสาธิตนี้เป็นข้อมูลจำลองที่สร้างขึ้นเองและไม่ได้อ้างอิงบุคคลจริง
          รหัสผ่านถูกเก็บในรูปแบบแฮชเสมอ และไม่มีการส่งข้อมูลออกไปยังบริการภายนอก
        </p>
      </section>

      <section id="contact" className="space-y-3 scroll-mt-20">
        <h2 className="text-lg font-semibold tracking-tight">ติดต่อฝ่ายบริการ</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="surface-card flex items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
              <Mail className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">อีเมล</p>
              <p className="text-sm font-medium">{brand.supportEmail}</p>
            </div>
          </div>
          <div className="surface-card flex items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
              <MessageCircle className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">LINE</p>
              <p className="text-sm font-medium">{brand.supportLine}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">ช่องทางติดต่อข้างต้นเป็นข้อมูลตัวอย่างสำหรับเดโม</p>
      </section>
    </div>
  );
}
