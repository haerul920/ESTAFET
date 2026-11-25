"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Camera } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormMessage, TextField } from "@/components/ui/Field";
import { removeAvatar, saveAvatar, saveProfileName } from "@/app/actions/account";
import { AVATAR_MAX_BYTES, AVATAR_MAX_SOURCE_BYTES } from "@/lib/account/avatar";

const SIDE = 512;

/**
 * Cuts the middle square out of a picture and saves it as a small JPEG. Drawing it again also leaves behind the hidden
 * data cameras add, such as the place the photo was taken.
 */
async function squareJpeg(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file);
  const crop = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(SIDE, crop);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    bitmap,
    (bitmap.width - crop) / 2,
    (bitmap.height - crop) / 2,
    crop,
    crop,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

type Message = { tone: "error" | "success"; text: string } | null;

/** The top of the settings page: photo, name and the email address (which cannot be changed here). */
export function ProfileSettings({
  name,
  email,
  initials,
  photo,
}: {
  name: string;
  email: string;
  initials: string;
  photo: string | null;
}) {
  const t = useTranslations("account.profile");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(name);
  const [nameError, setNameError] = useState("");
  const [nameMessage, setNameMessage] = useState<Message>(null);
  const [photoMessage, setPhotoMessage] = useState<Message>(null);
  const [savingName, startName] = useTransition();
  const [savingPhoto, startPhoto] = useTransition();

  function upload(file: File) {
    startPhoto(async () => {
      setPhotoMessage(null);
      const fail = (text: string) => setPhotoMessage({ tone: "error", text });
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return fail(t("photoType"));
      if (file.size > AVATAR_MAX_SOURCE_BYTES) return fail(t("photoTooLarge"));
      const jpeg = await squareJpeg(file).catch(() => null);
      if (!jpeg || jpeg.size > AVATAR_MAX_BYTES) return fail(t("photoUnreadable"));
      const body = new FormData();
      body.set("photo", jpeg, "photo.jpg");
      const r = await saveAvatar(body);
      if (r.error) return fail(r.error);
      setPhotoMessage({ tone: "success", text: t("photoSaved") });
      router.refresh();
    });
  }

  function saveName(e: React.FormEvent) {
    e.preventDefault();
    startName(async () => {
      setNameError("");
      setNameMessage(null);
      const r = await saveProfileName(value);
      if (r.fieldError) return setNameError(r.fieldError);
      if (r.error) return setNameMessage({ tone: "error", text: r.error });
      setNameMessage({ tone: "success", text: t("nameSaved") });
      router.refresh();
    });
  }

  return (
    <Card as="section" aria-labelledby="profile-h" className="flex flex-col gap-5">
      <h2 id="profile-h" className="m-0 text-xl">
        {t("title")}
      </h2>

      <div className="flex flex-wrap items-center gap-4">
        {photo ? (
          // The photo is private and already small, so it is shown as it is, without the image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={t("photoAlt")} width={88} height={88} className="h-[88px] w-[88px] rounded-full" />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-black text-2xl font-semibold text-lime"
          >
            {initials}
          </span>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outlineBlue" loading={savingPhoto} onClick={() => input.current?.click()}>
              <Camera size={18} aria-hidden="true" /> {photo ? t("photoChange") : t("photoAdd")}
            </Button>
            {photo ? (
              <ConfirmDialog
                trigger={t("photoRemove")}
                title={t("photoRemoveTitle")}
                effect={t("photoRemoveEffect")}
                confirmLabel={t("photoRemove")}
                tone="danger"
                triggerVariant="danger"
                onConfirm={removeAvatar}
                onDone={() => {
                  setPhotoMessage(null);
                  router.refresh();
                }}
              />
            ) : null}
          </div>
          <span className="text-[13px] text-text-2">{t("photoHint")}</span>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={t("photoAdd")}
            tabIndex={-1}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
        </div>
      </div>
      {photoMessage ? <FormMessage tone={photoMessage.tone}>{photoMessage.text}</FormMessage> : null}

      <form onSubmit={saveName} noValidate className="flex flex-col gap-3">
        <TextField
          label={t("name")}
          name="full_name"
          autoComplete="name"
          maxLength={80}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setNameError("");
            setNameMessage(null);
          }}
          error={nameError}
          after={
            <Button
              type="submit"
              variant="outlineBlue"
              loading={savingName}
              disabled={savingName || value.trim() === name}
              className="shrink-0"
            >
              {t("nameSave")}
            </Button>
          }
        />
        {nameMessage ? <FormMessage tone={nameMessage.tone}>{nameMessage.text}</FormMessage> : null}
      </form>

      <TextField label={t("email")} value={email} readOnly hint={t("emailHint")} />
    </Card>
  );
}
