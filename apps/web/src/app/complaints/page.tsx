"use client";

import { useEffect, useState } from "react";
import { dictionary } from "@/lib/dictionary";
import { fetchMyComplaints, type Complaint, type ComplaintStatus } from "@/lib/moderation";
import { formatDate } from "@/lib/format-date";

const STATUS_LABEL: Record<ComplaintStatus, keyof typeof dictionary.moderation> = {
  pending: "statusPending",
  reviewing: "statusReviewing",
  resolved: "statusResolved",
  rejected: "statusRejected",
};

const CATEGORY_LABEL: Record<Complaint["category"], keyof typeof dictionary.moderation> = {
  fraud: "categoryFraud",
  prohibited_item: "categoryProhibitedItem",
  rudeness: "categoryRudeness",
  breach_of_agreement: "categoryBreachOfAgreement",
  fake_documents: "categoryFakeDocuments",
  spam: "categorySpam",
  other: "categoryOther",
};

function StatusBadge({ status }: { status: ComplaintStatus }) {
  const tone =
    status === "resolved"
      ? "bg-action/10 text-action"
      : status === "rejected"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>
      {dictionary.moderation[STATUS_LABEL[status]]}
    </span>
  );
}

/** ТЗ E12 п.12.6 — автор жалобы видит статус без раскрытия деталей решения. */
export default function MyComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);

  useEffect(() => {
    fetchMyComplaints()
      .then(setComplaints)
      .catch(() => setComplaints([]));
  }, []);

  return (
    <div className="py-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">
        {dictionary.moderation.myComplaintsTitle}
      </h1>

      <div className="mt-5 flex flex-col gap-2">
        {complaints === null ? (
          <p className="text-sm text-muted-foreground">{dictionary.moderation.loading}</p>
        ) : complaints.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dictionary.moderation.myComplaintsEmpty}</p>
        ) : (
          complaints.map((complaint) => (
            <div key={complaint.id} className="rounded-md border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-heading text-sm font-bold text-card-foreground">
                  {dictionary.moderation[CATEGORY_LABEL[complaint.category]]}
                </p>
                <StatusBadge status={complaint.status} />
              </div>
              {complaint.comment ? (
                <p className="mt-2 text-sm text-foreground">{complaint.comment}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {formatDate(complaint.createdAt.slice(0, 10))}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
