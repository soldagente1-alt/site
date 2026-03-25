import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";

export default function PendingItemsCard({ pendingItems }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {pendingItems.length ? (
            <AlertTriangle className="text-amber-500" />
          ) : (
            <CheckCircle2 className="text-green-600" />
          )}
          {pendingItems.length ? "Pendências" : "Tudo em dia"}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {pendingItems.length === 0 ? (
          <div className="p-4 bg-green-50 rounded-xl">
            <p className="font-medium text-green-800">Perfeito.</p>
            <p className="text-sm text-green-700">No momento, não encontramos pendências para sua conta.</p>
          </div>
        ) : (
          pendingItems.map((it) => {
            const Icon = it.icon;
            const isDanger = it.tone === "danger";

            return (
              <div
                key={it.id}
                className={[
                  "p-4 rounded-xl flex items-center justify-between gap-4",
                  isDanger ? "bg-red-50" : "bg-amber-50",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center">
                    <Icon className={isDanger ? "text-red-600" : "text-amber-600"} />
                  </div>
                  <div>
                    <p className="font-medium">{it.title}</p>
                    <p className="text-sm text-slate-600">{it.desc}</p>
                  </div>
                </div>

                <Link to={it.to}>
                  <Button variant={isDanger ? "destructive" : "default"} size="sm">
                    {it.cta}
                  </Button>
                </Link>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
