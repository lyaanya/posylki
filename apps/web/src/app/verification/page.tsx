"use client";

import { useEffect, useState } from "react";
import { dictionary } from "@/lib/dictionary";
import {
  VerificationApiError,
  effectiveVerificationStatus,
  fetchDocumentTypes,
  fetchMyVerification,
  submitVerification,
  uploadVerificationPhoto,
  type DocumentType,
  type OwnVerificationStatus,
  type VerificationRejectionReason,
} from "@/lib/verification";

type ReasonLabelKey =
  | "reasonUnreadablePhoto"
  | "reasonExpiredDocument"
  | "reasonDataMismatch"
  | "reasonSelfieMismatch"
  | "reasonReviewTimeout"
  | "reasonOther";

const REASON_LABEL: Record<VerificationRejectionReason, ReasonLabelKey> = {
  unreadable_photo: "reasonUnreadablePhoto",
  expired_document: "reasonExpiredDocument",
  data_mismatch: "reasonDataMismatch",
  selfie_mismatch: "reasonSelfieMismatch",
  review_timeout: "reasonReviewTimeout",
  other: "reasonOther",
};

function submittedAtLabel(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}


function errorMessage(err: unknown): string {
  if (err instanceof VerificationApiError) {
    switch (err.code) {
      case "VERIFICATION_ALREADY_PENDING":
        return dictionary.verification.alreadyPendingError;
      case "DOCUMENT_TYPE_NOT_FOUND":
        return dictionary.verification.documentTypeRequiredError;
      case "UNDERAGE":
        return dictionary.verification.underageError;
      case "DOCUMENT_ALREADY_USED":
        return dictionary.verification.documentAlreadyUsedError;
      default:
        return err.message || dictionary.verification.genericError;
    }
  }
  return dictionary.verification.genericError;
}

function PhotoField({
  label,
  path,
  isUploading,
  onSelect,
}: {
  label: string;
  path: string | null;
  isUploading: boolean;
  onSelect: (file: File) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-muted-foreground">{label}</label>
      <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-6 text-sm text-muted-foreground">
        {isUploading
          ? dictionary.verification.uploading
          : path
            ? dictionary.verification.replaceCta
            : dictionary.verification.uploadCta}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onSelect(file);
          }}
        />
      </label>
      {path ? <p className="mt-1 text-xs text-action">Фото загружено</p> : null}
    </div>
  );
}

function Disclosures() {
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-md bg-muted p-4">
      <div>
        <p className="text-sm font-bold text-foreground">{dictionary.verification.disclosureStorageTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{dictionary.verification.disclosureStorageText}</p>
      </div>
      <div>
        <p className="text-sm font-bold text-foreground">{dictionary.verification.disclosureMeaningTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{dictionary.verification.disclosureMeaningText}</p>
      </div>
    </div>
  );
}

/** ТЗ E04 пп.4.9/4.10/4.24/4.25 — подача заявки на верификацию и статус. */
export default function VerificationPage() {
  const [status, setStatus] = useState<OwnVerificationStatus | null>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [documentType, setDocumentType] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentPhotoPath, setDocumentPhotoPath] = useState<string | null>(null);
  const [selfiePhotoPath, setSelfiePhotoPath] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<"document" | "selfie" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    Promise.all([fetchMyVerification(), fetchDocumentTypes()])
      .then(([s, types]) => {
        setStatus(s);
        setDocumentTypes(types);
        setShowForm(effectiveVerificationStatus(s) === "not_submitted");
      })
      .catch(() => {
        setStatus({ status: "not_submitted", latestRequest: null });
        setShowForm(true);
      });
  }

  useEffect(load, []);

  async function handlePhoto(field: "document" | "selfie", file: File) {
    setError(null);
    setUploadingField(field);
    try {
      const path = await uploadVerificationPhoto(file);
      if (field === "document") setDocumentPhotoPath(path);
      else setSelfiePhotoPath(path);
    } catch {
      setError(dictionary.verification.uploadError);
    } finally {
      setUploadingField(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!documentType) {
      setError(dictionary.verification.documentTypeRequiredError);
      return;
    }
    if (!documentPhotoPath || !selfiePhotoPath) {
      setError(dictionary.verification.photosRequiredError);
      return;
    }

    setIsSubmitting(true);
    try {
      await submitVerification({
        documentType,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth,
        documentNumber: documentNumber.trim(),
        documentPhotoPath,
        selfiePhotoPath,
      });
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === null) {
    return (
      <div className="py-6">
        <p className="text-sm text-muted-foreground">{dictionary.verification.loading}</p>
      </div>
    );
  }

  const latest = status.latestRequest;
  const effective = effectiveVerificationStatus(status);

  return (
    <div className="py-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">{dictionary.verification.title}</h1>

      {!showForm && effective === "approved" ? (
        <div className="mt-5 rounded-md border border-action/30 bg-action/10 p-4">
          <p className="font-heading text-sm font-bold text-action">{dictionary.verification.approvedTitle}</p>
          <p className="mt-1.5 text-sm text-foreground">{dictionary.verification.approvedText}</p>
        </div>
      ) : null}

      {!showForm && effective === "pending" && latest ? (
        <div className="mt-5 rounded-md border border-border bg-card p-4 shadow-sm">
          <p className="font-heading text-sm font-bold text-card-foreground">{dictionary.verification.pendingTitle}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{dictionary.verification.pendingText}</p>
          <p className="mt-2 text-xs text-muted-foreground">{dictionary.verification.submittedAt(submittedAtLabel(latest.createdAt))}</p>
        </div>
      ) : null}

      {!showForm && effective === "rejected" && latest ? (
        <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 p-4">
          <p className="font-heading text-sm font-bold text-destructive">{dictionary.verification.rejectedTitle}</p>
          {latest.rejectionReasonCode ? (
            <p className="mt-2 text-sm text-foreground">
              <span className="font-medium">{dictionary.verification.rejectedReasonLabel}:</span>{" "}
              {dictionary.verification[REASON_LABEL[latest.rejectionReasonCode]]}
            </p>
          ) : null}
          {latest.rejectionComment ? (
            <p className="mt-1 text-sm text-foreground">
              <span className="font-medium">{dictionary.verification.rejectedCommentLabel}:</span> {latest.rejectionComment}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="font-heading mt-4 rounded-sm bg-action px-4 py-2 text-sm font-bold text-on-action"
          >
            {dictionary.verification.resubmitCta}
          </button>
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4 rounded-md border border-border bg-card p-4 shadow-sm">
          <div>
            <p className="font-heading text-sm font-bold text-card-foreground">{dictionary.verification.formTitle}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{dictionary.verification.formIntro}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground">{dictionary.verification.documentTypeLabel}</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              required
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">{dictionary.verification.documentTypePlaceholder}</option>
              {documentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-muted-foreground">{dictionary.verification.lastNameLabel}</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                maxLength={100}
                className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground">{dictionary.verification.firstNameLabel}</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                maxLength={100}
                className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground">{dictionary.verification.dateOfBirthLabel}</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              required
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground">{dictionary.verification.documentNumberLabel}</label>
            <input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              required
              maxLength={100}
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <PhotoField
            label={dictionary.verification.documentPhotoLabel}
            path={documentPhotoPath}
            isUploading={uploadingField === "document"}
            onSelect={(file) => handlePhoto("document", file)}
          />
          <PhotoField
            label={dictionary.verification.selfiePhotoLabel}
            path={selfiePhotoPath}
            isUploading={uploadingField === "selfie"}
            onSelect={(file) => handlePhoto("selfie", file)}
          />

          <Disclosures />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || uploadingField !== null}
            className="font-heading rounded-sm bg-action py-2.5 text-sm font-bold text-on-action disabled:opacity-60"
          >
            {isSubmitting ? dictionary.verification.submitting : dictionary.verification.submitCta}
          </button>
        </form>
      ) : null}
    </div>
  );
}
