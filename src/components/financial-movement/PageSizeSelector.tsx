import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PageSizeSelectorProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
}

export function PageSizeSelector({ 
  pageSize, 
  onPageSizeChange,
  disabled = false 
}: PageSizeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="page-size" className="text-sm text-muted-foreground whitespace-nowrap">
        Itens por página:
      </Label>
      <Select
        value={String(pageSize)}
        onValueChange={(value) => onPageSizeChange(Number(value))}
        disabled={disabled}
      >
        <SelectTrigger id="page-size" className="w-[80px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="5">5</SelectItem>
          <SelectItem value="10">10</SelectItem>
          <SelectItem value="20">20</SelectItem>
          <SelectItem value="50">50</SelectItem>
          <SelectItem value="100">100</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}