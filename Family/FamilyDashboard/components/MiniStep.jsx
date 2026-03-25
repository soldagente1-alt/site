import React from "react";
import { Badge } from "../../../../components/ui/badge";

export default function MiniStep({ title, badge, badgeClass, desc }) {
  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{title}</p>
        <Badge className={badgeClass || "bg-slate-100 text-slate-700"}>{badge}</Badge>
      </div>
      <p className="text-xs text-slate-500 mt-1">{desc || " "}</p>
    </div>
  );
}
