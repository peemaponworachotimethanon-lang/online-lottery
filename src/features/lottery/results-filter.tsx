'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = '__all__';

export function ResultsFilter({
  lotteries,
  selectedLottery,
  selectedDate,
}: {
  lotteries: Array<{ id: string; name: string }>;
  selectedLottery: string;
  selectedDate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const apply = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="filter-lottery">หวย</Label>
        <Select
          value={selectedLottery || ALL}
          onValueChange={(value) => apply({ lottery: value === ALL ? '' : value })}
        >
          <SelectTrigger id="filter-lottery">
            <SelectValue placeholder="ทุกหวย" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกหวย</SelectItem>
            {lotteries.map((lottery) => (
              <SelectItem key={lottery.id} value={lottery.id}>
                {lottery.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 space-y-1.5">
        <Label htmlFor="filter-date">วันที่ประกาศผล</Label>
        <Input
          id="filter-date"
          type="date"
          value={selectedDate}
          onChange={(event) => apply({ date: event.target.value })}
        />
      </div>

      <Button variant="outline" onClick={() => router.push(pathname)}>
        <RotateCcw /> ล้างตัวกรอง
      </Button>
    </div>
  );
}
