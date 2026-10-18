// Ангийн холбоо барих мэдээлэл ("Холбоо барих" хэсэг болон footer-т нэг дороос)

export const CONTACT = {
  address: "Сонсголон цэргийн хүрээ",
  phone: "7217-2146",
  phoneHref: "tel:+97672172146",
  email: "unit013@gmail.com",
};

// Холбоо барих формын талбар бүрийн дээд урт (формын maxLength, API, өгөгдлийн сан бүгд ашиглана)
export const CONTACT_LIMITS = { name: 100, email: 200, subject: 200, message: 5000 } as const;
