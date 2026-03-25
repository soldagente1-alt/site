import React from "react";
import { Card, CardContent } from "../../../../components/ui/card";

export default function InfoCard({ icon: Icon, label, children }) {
  return (
    <Card>
      <CardContent className="p-4 flex gap-3 items-center">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 w-full">
          <p className="text-sm text-slate-500">{label}</p>
          <div className="font-bold">{children}</div>
        </div>
      </CardContent>
    </Card>
  );
}
