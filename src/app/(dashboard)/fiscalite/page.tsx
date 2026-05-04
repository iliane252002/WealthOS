"use client";

import { Percent, TrendingDown, Home, Building2, Receipt, Wrench } from "lucide-react";

interface CardProps {
  icon: React.ReactNode;
  title: string;
  tags: string[];
  bullets: string[];
  conseil: string;
}

function TaxCard({ icon, title, tags, bullets, conseil }: CardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900 leading-tight">{title}</h2>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Conseil :</span> {conseil}
        </p>
      </div>
    </div>
  );
}

export default function FiscalitePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fiscalité immobilière</h1>
        <p className="text-sm text-slate-500 mt-1">
          Optimisez votre fiscalité — conseils pour bailleurs, SCI et LMNP
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TaxCard
          icon={<Percent size={20} />}
          title="Régime réel vs micro-foncier"
          tags={["Foncier", "Revenus locatifs", "Déclaration"]}
          bullets={[
            "Le micro-foncier s'applique si vos recettes brutes sont inférieures à 15 000 € par an : un abattement forfaitaire de 30 % est appliqué automatiquement.",
            "Le régime réel permet de déduire les charges réelles (travaux, intérêts d'emprunt, assurances, taxes…), souvent plus avantageux dès que vos charges dépassent 30 % des loyers.",
            "Une fois opté pour le réel, vous y restez pendant 3 ans — la décision doit être mûrement réfléchie.",
            "Le régime réel ouvre droit au déficit foncier, contrairement au micro-foncier.",
          ]}
          conseil="Si vos charges annuelles dépassent 4 500 € pour 15 000 € de loyers, le régime réel est presque toujours plus avantageux. Faites la simulation avant le 31 mai."
        />

        <TaxCard
          icon={<TrendingDown size={20} />}
          title="Déficit foncier"
          tags={["Régime réel", "Économie d'impôt", "Travaux"]}
          bullets={[
            "Lorsque vos charges déductibles dépassent vos revenus fonciers, le déficit est imputable sur votre revenu global à hauteur de 10 700 € par an.",
            "La fraction excédant 10 700 € est reportable sur les revenus fonciers des 10 années suivantes.",
            "Le bien doit rester en location pendant au moins 3 ans après l'imputation, sous peine de remise en cause du bénéfice.",
            "Les intérêts d'emprunt ne s'imputent que sur les revenus fonciers (pas sur le revenu global).",
          ]}
          conseil="Le déficit foncier est particulièrement puissant si vous êtes dans une tranche marginale élevée (41 % ou 45 %). Combinez-le avec des travaux de rénovation énergétique pour maximiser l'effet."
        />

        <TaxCard
          icon={<Home size={20} />}
          title="LMNP — Loueur Meublé Non Professionnel"
          tags={["LMNP", "BIC", "Amortissement"]}
          bullets={[
            "Le LMNP relève des Bénéfices Industriels et Commerciaux (BIC) et non des revenus fonciers — régime fiscal distinct.",
            "Seuil : recettes locatives < 23 000 €/an OU < 50 % de vos revenus totaux. Au-delà, vous basculez en LMP.",
            "Au régime réel BIC, vous pouvez amortir le bien (hors terrain) sur 20 à 40 ans et le mobilier sur 5 à 10 ans, créant un déficit comptable sans impact fiscal immédiat.",
            "Le résultat LMNP est souvent nul ou négatif grâce aux amortissements, permettant de percevoir des loyers quasi nets d'impôt pendant de nombreuses années.",
          ]}
          conseil="Tenez une comptabilité rigoureuse et faites appel à un expert-comptable spécialisé LMNP. Les amortissements doivent être justifiés et cohérents avec la valeur du bien."
        />

        <TaxCard
          icon={<Building2 size={20} />}
          title="SCI à l'IS vs SCI à l'IR"
          tags={["SCI", "IS", "IR", "Transmission"]}
          bullets={[
            "SCI à l'IR : transparence fiscale — les bénéfices et déficits sont directement intégrés dans la déclaration de revenus des associés, avec accès au déficit foncier.",
            "SCI à l'IS : la société est imposée à 15 % jusqu'à 42 500 € de bénéfice, puis 25 %. Elle peut amortir les biens comme en LMNP, générant un résultat comptable faible.",
            "En SCI à l'IS, les dividendes versés aux associés sont imposés à nouveau (flat tax 30 % ou barème), créant une double imposition.",
            "La SCI à l'IS est souvent privilégiée pour conserver les bénéfices dans la structure, financer de nouveaux achats, ou optimiser la transmission patrimoniale.",
          ]}
          conseil="La SCI à l'IS est rarement intéressante si vous avez besoin des revenus locatifs pour vivre. Elle convient surtout à une stratégie de capitalisation à long terme avec réinvestissement des loyers."
        />

        <TaxCard
          icon={<Receipt size={20} />}
          title="Charges déductibles en régime réel"
          tags={["Déductions", "Régime réel", "Foncier"]}
          bullets={[
            "Intérêts d'emprunt et frais de dossier liés au crédit immobilier affecté au bien loué.",
            "Primes d'assurance : PNO (Propriétaire Non Occupant), assurance loyers impayés (GLI).",
            "Taxe foncière (hors ordures ménagères si refacturée au locataire), frais de gestion locative, honoraires d'agence.",
            "Travaux d'entretien, de réparation et d'amélioration (attention : la distinction amélioration / construction est stricte), charges de copropriété non récupérables, honoraires de comptable.",
          ]}
          conseil="Conservez tous vos justificatifs pendant au moins 6 ans. Un relevé de dépenses trimestriel dans WealthOS vous permettra de préparer votre déclaration 2044 sans stress."
        />

        <TaxCard
          icon={<Wrench size={20} />}
          title="Travaux : entretien vs amélioration"
          tags={["Travaux", "Déductibilité", "LMNP", "Foncier"]}
          bullets={[
            "Travaux d'entretien et réparation : déductibles immédiatement en revenus fonciers (remise en état, remplacement à l'identique, ravalement…).",
            "Travaux d'amélioration : non déductibles en revenus fonciers classiques, mais amortissables sur leur durée d'utilisation en LMNP ou SCI à l'IS.",
            "Travaux de construction ou reconstruction : jamais déductibles, ni en foncier ni en LMNP (ils augmentent la valeur du bien et s'incorporent dans le prix de revient).",
            "En cas de doute, la doctrine fiscale retient que le remplacement d'un élément de confort supérieur à l'existant est une amélioration (ex : simple chauffage → climatisation réversible).",
          ]}
          conseil="Avant d'engager des travaux importants, consultez un fiscaliste pour qualifier correctement les dépenses. Une mauvaise classification peut entraîner un redressement lors d'un contrôle fiscal."
        />
      </div>

      {/* Disclaimer */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500">
        <p>
          <span className="font-medium text-slate-700">Note :</span> Ces informations sont fournies
          à titre indicatif et pédagogique. Elles ne constituent pas un conseil fiscal personnalisé.
          Consultez un expert-comptable ou un conseiller fiscal pour toute décision fiscale importante.
          La législation fiscale peut évoluer — vérifiez les seuils et règles applicables à votre situation.
        </p>
      </div>
    </div>
  );
}
