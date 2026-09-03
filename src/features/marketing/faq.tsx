import { ChevronDown } from 'lucide-react';

export const FAQ_ITEMS = [
  {
    question: 'ระบบนี้ใช้เงินจริงหรือไม่',
    answer:
      'ไม่ใช้ ระบบนี้อยู่ในโหมดสาธิต (mock) ทั้งการฝากและถอนเป็นการจำลองทั้งหมด ไม่มีการเชื่อมต่อกับระบบชำระเงินจริง',
  },
  {
    question: 'เริ่มต้นแทงหวยอย่างไร',
    answer:
      'เข้าสู่ระบบด้วยบัญชีทดลอง เลือกหวยที่เปิดรับแทง เลือกประเภทการแทง ใส่เลขและจำนวนเงิน กด "เพิ่มลงโพย" แล้วยืนยันการแทง',
  },
  {
    question: 'ยอดเงินถูกหักตอนไหน',
    answer:
      'ยอดเงินจะถูกหักทันทีเมื่อยืนยันการแทงสำเร็จ และจะมีรายการบันทึกในประวัติธุรกรรมพร้อมยอดก่อน–หลังทุกครั้ง',
  },
  {
    question: 'อัตราจ่ายคิดอย่างไร',
    answer:
      'อัตราจ่ายถูกบันทึกไว้ ณ เวลาที่แทง (rateAtBet) หากผู้ดูแลระบบแก้ไขอัตราจ่ายภายหลัง บิลที่แทงไปแล้วจะยังใช้อัตราเดิมเสมอ',
  },
  {
    question: 'ถอนเงินแล้วยอดหายไปทันทีเลยหรือไม่',
    answer:
      'เมื่อส่งคำขอถอน ระบบจะ "กันวงเงิน" ออกจากยอดที่ใช้ได้ทันทีเพื่อป้องกันการใช้เงินซ้ำ หากคำขอถูกปฏิเสธ เงินจะถูกคืนเข้ากระเป๋าโดยอัตโนมัติ',
  },
  {
    question: 'ผลรางวัลออกเมื่อไร',
    answer:
      'แต่ละหวยมีเวลาออกผลของตัวเอง แสดงอยู่ในหน้ารายละเอียดหวย เมื่อผู้ดูแลระบบบันทึกผล ระบบจะเคลียร์รางวัลและโอนเงินเข้ากระเป๋าให้อัตโนมัติ',
  },
];

/**
 * Native `<details>` accordion — keyboard accessible and open-by-default for
 * search engines and screen readers, with zero client JavaScript.
 */
export function FaqAccordion() {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      {FAQ_ITEMS.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-surface-muted">
            {item.question}
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="px-4 pb-4 text-sm text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
