"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type Locale = "en" | "fr";

const translations = {
  // ── Navigation ──
  "nav.dashboard": { en: "Dashboard", fr: "Tableau de bord" },
  "nav.properties": { en: "Properties", fr: "Biens immobiliers" },
  "nav.tenants": { en: "Tenants", fr: "Locataires" },
  "nav.documents": { en: "Documents", fr: "Documents" },
  "nav.works": { en: "Works", fr: "Travaux" },
  "nav.investments": { en: "Investments", fr: "Investissements" },
  "nav.timeline": { en: "Timeline", fr: "Chronologie" },
  "nav.notifications": { en: "Notifications", fr: "Notifications" },
  "nav.settings": { en: "Settings", fr: "Paramètres" },

  // ── Topbar ──
  "topbar.welcome": { en: "Welcome back,", fr: "Bon retour," },
  "topbar.investor": { en: "Investor", fr: "Investisseur" },
  "topbar.signOut": { en: "Sign out", fr: "Se déconnecter" },
  "topbar.settings": { en: "Settings", fr: "Paramètres" },

  // ── Dashboard ──
  "dashboard.title": { en: "Dashboard", fr: "Tableau de bord" },
  "dashboard.wealthScore": { en: "Wealth Score", fr: "Score patrimonial" },
  "dashboard.totalNetWorth": { en: "Total Net Worth", fr: "Patrimoine net total" },
  "dashboard.realEstate": { en: "Real Estate:", fr: "Immobilier :" },
  "dashboard.investments": { en: "Investments:", fr: "Investissements :" },
  "dashboard.monthlyIncome": { en: "Monthly Income", fr: "Revenus mensuels" },
  "dashboard.collected": { en: "Collected:", fr: "Collecté :" },
  "dashboard.occupancyRate": { en: "Occupancy Rate", fr: "Taux d'occupation" },
  "dashboard.properties": { en: "properties", fr: "biens" },
  "dashboard.lots": { en: "lots", fr: "lots" },
  "dashboard.latePayments": { en: "Late Payments", fr: "Retards de paiement" },
  "dashboard.actionRequired": { en: "Action required", fr: "Action requise" },
  "dashboard.allOnTrack": { en: "All on track", fr: "Tout est en ordre" },
  "dashboard.wealthBreakdown": { en: "Wealth Score Breakdown", fr: "Détail du score patrimonial" },
  "dashboard.occupancy": { en: "Occupancy", fr: "Occupation" },
  "dashboard.incomeRegularity": { en: "Income Regularity", fr: "Régularité des revenus" },
  "dashboard.diversification": { en: "Diversification", fr: "Diversification" },
  "dashboard.growth": { en: "Growth", fr: "Croissance" },
  "dashboard.base": { en: "Base", fr: "Base" },
  "dashboard.viewAll": { en: "View all", fr: "Voir tout" },
  "dashboard.property": { en: "Property", fr: "Bien" },
  "dashboard.tenant": { en: "Tenant", fr: "Locataire" },
  "dashboard.dueDate": { en: "Due Date", fr: "Échéance" },
  "dashboard.amount": { en: "Amount", fr: "Montant" },
  "dashboard.noLatePayments": { en: "No late payments", fr: "Aucun retard de paiement" },
  "dashboard.addProperty": { en: "Add Property", fr: "Ajouter un bien" },
  "dashboard.addPropertyDesc": { en: "Register a new real estate asset", fr: "Enregistrer un nouveau bien immobilier" },
  "dashboard.manageTenants": { en: "Manage Tenants", fr: "Gérer les locataires" },
  "dashboard.manageTenantsDesc": { en: "View and manage your tenants", fr: "Consulter et gérer vos locataires" },
  "dashboard.investmentsAction": { en: "Investments", fr: "Investissements" },
  "dashboard.investmentsDesc": { en: "Track your financial portfolio", fr: "Suivre votre portefeuille financier" },

  // ── Properties ──
  "properties.title": { en: "Properties", fr: "Biens immobiliers" },
  "properties.addProperty": { en: "Add Property", fr: "Ajouter un bien" },
  "properties.noProperties": { en: "No properties yet", fr: "Aucun bien immobilier" },
  "properties.noPropertiesDesc": { en: "Start building your portfolio by adding your first property.", fr: "Commencez à construire votre portefeuille en ajoutant votre premier bien." },
  "properties.addFirst": { en: "Add Your First Property", fr: "Ajouter votre premier bien" },
  "properties.value": { en: "Value", fr: "Valeur" },
  "properties.occupancy": { en: "Occupancy", fr: "Occupation" },
  "properties.gainLoss": { en: "Gain/Loss", fr: "Plus/Moins-value" },
  "properties.apartment": { en: "Apartment", fr: "Appartement" },
  "properties.house": { en: "House", fr: "Maison" },
  "properties.building": { en: "Building", fr: "Immeuble" },

  // ── Property New ──
  "propertyNew.title": { en: "Add Property", fr: "Ajouter un bien" },
  "propertyNew.basicInfo": { en: "BASIC INFORMATION", fr: "INFORMATIONS GÉNÉRALES" },
  "propertyNew.propertyName": { en: "Property Name", fr: "Nom du bien" },
  "propertyNew.namePlaceholder": { en: 'e.g. "Residence Lumiere"', fr: 'ex. "Résidence Lumière"' },
  "propertyNew.type": { en: "Type", fr: "Type" },
  "propertyNew.selectType": { en: "Select type", fr: "Sélectionner le type" },
  "propertyNew.ownership": { en: "Ownership", fr: "Détention" },
  "propertyNew.personal": { en: "Personal", fr: "Personnel" },
  "propertyNew.sci": { en: "SCI", fr: "SCI" },
  "propertyNew.address": { en: "ADDRESS", fr: "ADRESSE" },
  "propertyNew.streetAddress": { en: "Street Address", fr: "Adresse" },
  "propertyNew.addressPlaceholder": { en: "123 Rue de la Paix", fr: "123 Rue de la Paix" },
  "propertyNew.city": { en: "City", fr: "Ville" },
  "propertyNew.cityPlaceholder": { en: "Paris", fr: "Paris" },
  "propertyNew.postalCode": { en: "Postal Code", fr: "Code postal" },
  "propertyNew.postalCodePlaceholder": { en: "75001", fr: "75001" },
  "propertyNew.financial": { en: "FINANCIAL DETAILS", fr: "DÉTAILS FINANCIERS" },
  "propertyNew.purchasePrice": { en: "Purchase Price", fr: "Prix d'acquisition" },
  "propertyNew.currentValue": { en: "Current Value", fr: "Valeur actuelle" },
  "propertyNew.surface": { en: "Surface (m2)", fr: "Surface (m²)" },
  "propertyNew.acquisitionDate": { en: "Acquisition Date", fr: "Date d'acquisition" },
  "propertyNew.cancel": { en: "Cancel", fr: "Annuler" },
  "propertyNew.create": { en: "Create Property", fr: "Créer le bien" },
  "propertyNew.creating": { en: "Creating...", fr: "Création..." },
  "propertyNew.buildingNote": { en: "For buildings, you can add individual lots after creation.", fr: "Pour les immeubles, vous pourrez ajouter les lots après la création." },

  // ── Property Detail ──
  "propertyDetail.overview": { en: "Overview", fr: "Vue d'ensemble" },
  "propertyDetail.lots": { en: "Lots", fr: "Lots" },
  "propertyDetail.documents": { en: "Documents", fr: "Documents" },
  "propertyDetail.works": { en: "Works", fr: "Travaux" },
  "propertyDetail.propertyDetails": { en: "Property Details", fr: "Détails du bien" },
  "propertyDetail.type": { en: "Type:", fr: "Type :" },
  "propertyDetail.ownership": { en: "Ownership:", fr: "Détention :" },
  "propertyDetail.surface": { en: "Surface:", fr: "Surface :" },
  "propertyDetail.country": { en: "Country:", fr: "Pays :" },
  "propertyDetail.financialSummary": { en: "Financial Summary", fr: "Résumé financier" },
  "propertyDetail.purchasePrice": { en: "Purchase Price:", fr: "Prix d'achat :" },
  "propertyDetail.currentValue": { en: "Current Value:", fr: "Valeur actuelle :" },
  "propertyDetail.occupancy": { en: "Occupancy:", fr: "Occupation :" },
  "propertyDetail.lotsCount": { en: "Lots:", fr: "Lots :" },
  "propertyDetail.occupied": { en: "occupied", fr: "occupé(s)" },
  "propertyDetail.addLot": { en: "Add Lot", fr: "Ajouter un lot" },
  "propertyDetail.lotLabel": { en: "Label (e.g. Apt 3B)", fr: "Libellé (ex. Apt 3B)" },
  "propertyDetail.lotSurface": { en: "Surface (m2)", fr: "Surface (m²)" },
  "propertyDetail.lotRooms": { en: "Rooms", fr: "Pièces" },
  "propertyDetail.createLot": { en: "Create Lot", fr: "Créer le lot" },
  "propertyDetail.creatingLot": { en: "Creating...", fr: "Création..." },
  "propertyDetail.noLots": { en: "No lots yet. Add your first lot to start tracking.", fr: "Aucun lot. Ajoutez votre premier lot pour commencer." },
  "propertyDetail.attachTenant": { en: "Attach Tenant", fr: "Associer un locataire" },
  "propertyDetail.selectTenant": { en: "Select tenant", fr: "Sélectionner un locataire" },
  "propertyDetail.monthlyRent": { en: "Monthly Rent", fr: "Loyer mensuel" },
  "propertyDetail.createLease": { en: "Create Lease", fr: "Créer le bail" },
  "propertyDetail.noDocuments": { en: "No documents yet", fr: "Aucun document" },
  "propertyDetail.goToDocuments": { en: "Go to Documents", fr: "Aller aux documents" },
  "propertyDetail.noWorks": { en: "No works tracked yet", fr: "Aucun travaux suivi" },
  "propertyDetail.goToWorks": { en: "Go to Works", fr: "Aller aux travaux" },
  "propertyDetail.notFound": { en: "Property not found", fr: "Bien introuvable" },
  "propertyDetail.backToProperties": { en: "Back to properties", fr: "Retour aux biens" },

  // ── Tenants ──
  "tenants.title": { en: "Tenants", fr: "Locataires" },
  "tenants.addTenant": { en: "Add Tenant", fr: "Ajouter un locataire" },
  "tenants.cancel": { en: "Cancel", fr: "Annuler" },
  "tenants.firstName": { en: "First Name", fr: "Prénom" },
  "tenants.lastName": { en: "Last Name", fr: "Nom" },
  "tenants.email": { en: "Email", fr: "Email" },
  "tenants.phone": { en: "Phone", fr: "Téléphone" },
  "tenants.notes": { en: "Notes", fr: "Notes" },
  "tenants.creating": { en: "Creating...", fr: "Création..." },
  "tenants.createTenant": { en: "Create Tenant", fr: "Créer le locataire" },
  "tenants.noTenants": { en: "No tenants yet", fr: "Aucun locataire" },
  "tenants.noTenantsDesc": { en: "Add your first tenant to start managing leases.", fr: "Ajoutez votre premier locataire pour gérer vos baux." },
  "tenants.name": { en: "Name", fr: "Nom" },
  "tenants.contact": { en: "Contact", fr: "Contact" },
  "tenants.activeLease": { en: "Active Lease", fr: "Bail actif" },
  "tenants.actions": { en: "Actions", fr: "Actions" },
  "tenants.noActiveLease": { en: "No active lease", fr: "Aucun bail actif" },

  // ── Investments ──
  "investments.title": { en: "Investments", fr: "Investissements" },
  "investments.addPosition": { en: "Add Position", fr: "Ajouter une position" },
  "investments.cancel": { en: "Cancel", fr: "Annuler" },
  "investments.totalValue": { en: "Total Portfolio Value", fr: "Valeur totale du portefeuille" },
  "investments.totalGainLoss": { en: "Total Gain/Loss", fr: "Plus/Moins-value totale" },
  "investments.performance": { en: "Performance", fr: "Performance" },
  "investments.name": { en: "Name", fr: "Nom" },
  "investments.assetType": { en: "Asset Type", fr: "Type d'actif" },
  "investments.selectType": { en: "Select type", fr: "Sélectionner le type" },
  "investments.quantity": { en: "Quantity", fr: "Quantité" },
  "investments.buyPrice": { en: "Buy Price", fr: "Prix d'achat" },
  "investments.currentPrice": { en: "Current Price", fr: "Prix actuel" },
  "investments.ticker": { en: "Ticker", fr: "Ticker" },
  "investments.broker": { en: "Broker", fr: "Courtier" },
  "investments.account": { en: "Account", fr: "Compte" },
  "investments.accountPlaceholder": { en: "PEA, CTO...", fr: "PEA, CTO..." },
  "investments.adding": { en: "Adding...", fr: "Ajout..." },
  "investments.noInvestments": { en: "No investments yet", fr: "Aucun investissement" },
  "investments.noInvestmentsDesc": { en: "Start tracking your financial portfolio.", fr: "Commencez à suivre votre portefeuille financier." },
  "investments.asset": { en: "Asset", fr: "Actif" },
  "investments.type": { en: "Type", fr: "Type" },
  "investments.qty": { en: "Qty", fr: "Qté" },
  "investments.current": { en: "Current", fr: "Actuel" },
  "investments.gainLoss": { en: "Gain/Loss", fr: "Plus/Moins-value" },
  "investments.actions": { en: "Actions", fr: "Actions" },
  "investments.stock": { en: "Stock", fr: "Action" },
  "investments.etf": { en: "ETF", fr: "ETF" },
  "investments.bond": { en: "Bond", fr: "Obligation" },
  "investments.crypto": { en: "Crypto", fr: "Crypto" },
  "investments.fund": { en: "Fund", fr: "Fonds" },
  "investments.savings": { en: "Savings", fr: "Épargne" },
  "investments.lifeInsurance": { en: "Life Insurance", fr: "Assurance-vie" },
  "investments.other": { en: "Other", fr: "Autre" },

  // ── Documents ──
  "documents.title": { en: "Documents", fr: "Documents" },
  "documents.addDocument": { en: "Add Document", fr: "Ajouter un document" },
  "documents.cancel": { en: "Cancel", fr: "Annuler" },
  "documents.search": { en: "Search documents...", fr: "Rechercher un document..." },
  "documents.allCategories": { en: "All Categories", fr: "Toutes les catégories" },
  "documents.lease": { en: "Lease", fr: "Bail" },
  "documents.insurance": { en: "Insurance", fr: "Assurance" },
  "documents.tax": { en: "Tax", fr: "Fiscalité" },
  "documents.invoice": { en: "Invoice", fr: "Facture" },
  "documents.photo": { en: "Photo", fr: "Photo" },
  "documents.diagnostic": { en: "Diagnostic", fr: "Diagnostic" },
  "documents.receipt": { en: "Receipt", fr: "Reçu" },
  "documents.other": { en: "Other", fr: "Autre" },
  "documents.documentName": { en: "Document Name", fr: "Nom du document" },
  "documents.category": { en: "Category", fr: "Catégorie" },
  "documents.property": { en: "Property (optional)", fr: "Bien (optionnel)" },
  "documents.none": { en: "None", fr: "Aucun" },
  "documents.description": { en: "Description", fr: "Description" },
  "documents.saving": { en: "Saving...", fr: "Enregistrement..." },
  "documents.save": { en: "Save Document", fr: "Enregistrer" },
  "documents.noDocuments": { en: "No documents yet", fr: "Aucun document" },
  "documents.noDocumentsDesc": { en: "Upload and organize your property documents.", fr: "Téléchargez et organisez les documents de vos biens." },

  // ── Works ──
  "works.title": { en: "Works & Renovations", fr: "Travaux & Rénovations" },
  "works.addWork": { en: "Add Work", fr: "Ajouter un travail" },
  "works.cancel": { en: "Cancel", fr: "Annuler" },
  "works.totalCost": { en: "Total Cost", fr: "Coût total" },
  "works.taxDeductible": { en: "Tax Deductible", fr: "Déductible" },
  "works.all": { en: "All", fr: "Tous" },
  "works.planned": { en: "PLANNED", fr: "PLANIFIÉ" },
  "works.inProgress": { en: "IN_PROGRESS", fr: "EN COURS" },
  "works.completed": { en: "COMPLETED", fr: "TERMINÉ" },
  "works.cancelled": { en: "CANCELLED", fr: "ANNULÉ" },
  "works.workTitle": { en: "Title", fr: "Titre" },
  "works.property": { en: "Property", fr: "Bien" },
  "works.selectProperty": { en: "Select property", fr: "Sélectionner un bien" },
  "works.contractor": { en: "Contractor", fr: "Entrepreneur" },
  "works.cost": { en: "Cost", fr: "Coût" },
  "works.status": { en: "Status", fr: "Statut" },
  "works.taxDeductibleLabel": { en: "Tax deductible", fr: "Déductible des impôts" },
  "works.description": { en: "Description", fr: "Description" },
  "works.creating": { en: "Creating...", fr: "Création..." },
  "works.createWork": { en: "Create Work", fr: "Créer le travail" },
  "works.noWorks": { en: "No works tracked", fr: "Aucun travaux suivi" },
  "works.noWorksDesc": { en: "Track renovations and maintenance for your properties.", fr: "Suivez les rénovations et l'entretien de vos biens." },
  "works.tax": { en: "Tax", fr: "Impôt" },
  "works.actions": { en: "Actions", fr: "Actions" },

  // ── Timeline ──
  "timeline.title": { en: "Timeline", fr: "Chronologie" },
  "timeline.all": { en: "All", fr: "Tous" },
  "timeline.rentPaid": { en: "Rent Paid", fr: "Loyer payé" },
  "timeline.lateRent": { en: "Late Rent", fr: "Loyer en retard" },
  "timeline.work": { en: "Work", fr: "Travaux" },
  "timeline.noEvents": { en: "No events yet", fr: "Aucun événement" },
  "timeline.noEventsDesc": { en: "Your activity will appear here as you use the platform.", fr: "Votre activité apparaîtra ici au fil de votre utilisation." },

  // ── Notifications ──
  "notifications.title": { en: "Notifications", fr: "Notifications" },
  "notifications.markAllRead": { en: "Mark all as read", fr: "Tout marquer comme lu" },
  "notifications.noNotifications": { en: "No notifications", fr: "Aucune notification" },
  "notifications.allCaughtUp": { en: "You're all caught up.", fr: "Vous êtes à jour." },

  // ── Settings ──
  "settings.title": { en: "Settings", fr: "Paramètres" },
  "settings.profile": { en: "Profile", fr: "Profil" },
  "settings.account": { en: "Account", fr: "Compte" },
  "settings.signOut": { en: "Sign out", fr: "Se déconnecter" },
  "settings.language": { en: "Language", fr: "Langue" },

  // ── Auth ──
  "auth.appName": { en: "WealthOS", fr: "WealthOS" },
  "auth.signInTitle": { en: "Sign in to your account", fr: "Connectez-vous à votre compte" },
  "auth.invalidCredentials": { en: "Invalid email or password", fr: "Email ou mot de passe invalide" },
  "auth.email": { en: "Email", fr: "Email" },
  "auth.emailPlaceholder": { en: "you@example.com", fr: "vous@exemple.com" },
  "auth.password": { en: "Password", fr: "Mot de passe" },
  "auth.passwordPlaceholder": { en: "Min. 8 characters", fr: "Min. 8 caractères" },
  "auth.signingIn": { en: "Signing in...", fr: "Connexion..." },
  "auth.signIn": { en: "Sign in", fr: "Se connecter" },
  "auth.noAccount": { en: "Don't have an account?", fr: "Pas encore de compte ?" },
  "auth.createOne": { en: "Create one", fr: "Créer un compte" },
  "auth.createTitle": { en: "Create your account", fr: "Créez votre compte" },
  "auth.fullName": { en: "Full Name", fr: "Nom complet" },
  "auth.fullNamePlaceholder": { en: "John Doe", fr: "Jean Dupont" },
  "auth.creatingAccount": { en: "Creating account...", fr: "Création du compte..." },
  "auth.createAccount": { en: "Create account", fr: "Créer un compte" },
  "auth.hasAccount": { en: "Already have an account?", fr: "Déjà un compte ?" },

  // ── Common ──
  "common.cancel": { en: "Cancel", fr: "Annuler" },
  "common.delete": { en: "Delete", fr: "Supprimer" },
  "common.edit": { en: "Edit", fr: "Modifier" },
  "common.save": { en: "Enregistrer", fr: "Enregistrer" },
  "common.na": { en: "N/A", fr: "N/A" },
} as const;

export type TranslationKey = keyof typeof translations;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("wealthos-locale") as Locale) || "en";
    }
    return "en";
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem("wealthos-locale", newLocale);
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[locale] || entry.en;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}
