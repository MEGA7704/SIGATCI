export const MODULE_CONFIG={
  personnel:{title:'Personnel',singular:'Agent',subtitle:'Gestion des agents, matricules, fonctions et statuts.',fields:[['photo','Photo de l’agent','image'],['sexe','Sexe','select','Masculin|Féminin'],['matricule','Matricule','text'],['emploi','Emploi','text'],['fonction','Fonction','text'],['date_naissance','Date de naissance','date'],['date_prise_service_minef','Date de prise de service au MINEF','date'],['date_prise_service_gbeke','Date de prise de service dans la Région de Gbêkê','date'],['grade','Grade','text'],['classe','Classe','text'],['echelon','Échelon','text'],['handicap','Handicap','text'],['telephone','Numéro de téléphone','text']]},
  documents:{title:'Documents administratifs',singular:'Document administratif',subtitle:'Attestations, certificats, autorisations et documents officiels.',fields:[],documentTypes:{
    CESSATION_SERVICE:{label:'Cessation de service / mutation',singular:'Cessation de service / mutation',addLabel:'Ajouter Cessation / mutation',backendModule:'documents',fields:[
      ['grade_appellation','Grade / appellation (ex. Sergent-chef)','text'],
      ['matricule','Matricule','text'],
      ['emploi','Emploi / corps (ex. Moniteur des PVA)','text'],
      ['option_emploi','Option (ex. Eaux et Forêts)','text'],
      ['classe','Classe (ex. 1ère classe)','text'],
      ['echelon','Échelon (ex. 2ème échelon)','text'],
      ['ancien_service','Service / poste d’origine','text'],
      ['nouvelle_affectation','Nouveau poste d’affectation','text'],
      ['decision_numero','N° de la décision de mutation','text'],
      ['decision_date','Date de la décision de mutation','date'],
      ['decision_objet','Objet / libellé de la décision de mutation','textarea'],
      ['date_cessation','Date effective de cessation de service','date']
    ]},
    CESSATION_CONGE:{label:'Cessation de service / congé',singular:'Cessation de service / congé',addLabel:'Ajouter Cessation / congé',backendModule:'documents',fields:[
      ['grade_appellation','Grade / appellation (ex. Sergent-chef)','text'],
      ['matricule','Matricule','text'],
      ['emploi','Emploi / corps (ex. Moniteur des PVA)','text'],
      ['option_emploi','Option (ex. Eaux et Forêts)','text'],
      ['classe','Classe (ex. 1ère classe)','text'],
      ['echelon','Échelon (ex. 2ème échelon)','text'],
      ['type_conge','Nature du congé (ex. congé administratif annuel)','text'],
      ['duree_conge_jours','Durée du congé (jours)','number'],
      ['annee_conge','Année au titre de laquelle le congé est accordé','number'],
      ['decision_numero','N° de la décision autorisant le congé','text'],
      ['decision_date','Date de la décision','date'],
      ['decision_autorite','Autorité ayant pris la décision','text'],
      ['date_cessation','Date de cessation des activités professionnelles','date'],
      ['lieu_conge','Lieu où l’agent jouira de son congé','text'],
      ['date_reprise_prevue','Date prévue de reprise de service','date'],
      ['heure_reprise_prevue','Heure prévue de reprise','time']
    ]},
    REPRISE_SERVICE:{label:'Reprise de service / congé',singular:'Reprise de service / congé',addLabel:'Ajouter Reprise / congé',backendModule:'documents',fields:[
      ['grade_appellation','Grade / appellation (ex. Sergent-chef)','text'],
      ['matricule','Matricule','text'],
      ['emploi','Emploi / corps (ex. Moniteur des PVA)','text'],
      ['option_emploi','Option (ex. Eaux et Forêts)','text'],
      ['classe','Classe (ex. 1ère classe)','text'],
      ['echelon','Échelon (ex. 1er échelon)','text'],
      ['date_cessation','Date de cessation des activités professionnelles','date'],
      ['certificat_cessation_numero','N° du certificat de cessation de service','text'],
      ['certificat_cessation_date','Date du certificat de cessation (facultatif)','date'],
      ['certificat_cessation_origine','Autorité / service ayant établi le certificat de cessation','text'],
      ['duree_conge_jours','Durée du congé (jours)','number'],
      ['type_conge','Nature du congé / absence','text'],
      ['decision_numero','N° de la décision autorisant le congé','text'],
      ['decision_date','Date de la décision','date'],
      ['decision_autorite','Autorité ayant pris la décision','text'],
      ['service_reprise','Poste / service de reprise (facultatif)','text'],
      ['date_reprise','Date effective de reprise de service','date'],
      ['heure_reprise','Heure de reprise','time']
    ]},
    PRISE_SERVICE_MUTATION:{label:'Prise de service / mutation',singular:'Prise de service / mutation',addLabel:'Ajouter Prise / mutation',backendModule:'documents',fields:[
      ['grade_appellation','Grade / appellation (ex. Adjudant)','text'],
      ['matricule','Matricule','text'],
      ['emploi','Emploi / corps (ex. Moniteur des PVA)','text'],
      ['option_emploi','Option (ex. Eaux et Forêts)','text'],
      ['categorie','Catégorie (ex. C)','text'],
      ['grade_administratif','Grade administratif (ex. C2)','text'],
      ['classe','Classe (ex. classe principale)','text'],
      ['echelon','Échelon (ex. 2ème échelon)','text'],
      ['ancien_service','Service / poste précédent','text'],
      ['nouvelle_affectation','Nouveau poste d’affectation','text'],
      ['decision_numero','N° de la décision de mutation','text'],
      ['decision_date','Date de la décision de mutation','date'],
      ['decision_objet','Objet / libellé de la décision de mutation','textarea'],
      ['date_prise_service','Date effective de prise de service','date']
    ]},
    DEMANDE_EXPLICATION:{label:'Demande d’explication',singular:'Demande d’explication',addLabel:'Ajouter demande d’explication',backendModule:'documents',fields:[
      ['civilite','Civilité','select','Monsieur|Madame|Mademoiselle'],
      ['matricule','Matricule','text'],
      ['emploi_qualite','Emploi / qualité (ex. MPVA)','text'],
      ['service_affectation','Service d’affectation','text'],
      ['texte_demande','Texte / faits motivant la demande d’explication','textarea'],
      ['delai_reponse_heures','Délai de réponse (heures)','number'],
      ['reponse_agent','Réponse de l’agent (facultatif)','textarea']
    ]},
    ABSENCE:{label:'Autorisations d’absence',singular:'Autorisation d’absence',addLabel:'Ajouter autorisation',backendModule:'absences',fields:[
      ['date_demande',"Date de la demande d’absence",'date'],
      ['date_debut',"Date de début de l’absence",'date'],
      ['date_fin',"Date de fin de l’absence",'date'],
      ['nombre_jours',"Nombre de jours",'computed'],
      ['grade',"Grade / Appellation",'text'],
      ['matricule','Matricule','text'],
      ['emploi','Emploi','text'],
      ['destination','Destination','text'],
      ['motif','Motif','textarea']
    ]}
  }},
  absences:{title:"Autorisations d’absence",singular:"Autorisation d’absence",subtitle:"Rédaction, édition PDF et gestion des autorisations d’absence.",fields:[['date_demande',"Date de la demande d’absence",'date'],['date_debut',"Date de début de l’absence",'date'],['date_fin',"Date de fin de l’absence",'date'],['nombre_jours',"Nombre de jours",'computed'],['grade',"Grade / Appellation",'text'],['matricule','Matricule','text'],['emploi','Emploi','text'],['destination','Destination','text'],['motif','Motif','textarea']]},
  stages:{title:'Stages',singular:'Stage',subtitle:'Stagiaires, mises en stage et attestations de fin de stage.',fields:[],stageTypes:{MISE_STAGE:{label:'Mise en stage',singular:'Mise en stage',addLabel:'Ajouter mise en stage',fields:[['qualite_stagiaire','Qualité du stagiaire','text'],['matricule_stagiaire','Matricule / numéro du stagiaire','text'],['note_service_numero','N° de la note de service','text'],['note_service_date','Date de la note de service','date'],['note_service_origine','Autorité / service émetteur de la note','text'],['date_debut','Date de début du stage','date'],['heure_debut','Heure de début','time'],['duree_mois','Durée du stage (mois)','number'],['date_fin','Date de fin du stage','date'],['theme','Thème du stage','textarea']]},FIN_STAGE:{label:'Fin de stage',singular:'Fin de stage',addLabel:'Ajouter fin de stage',fields:[['qualite_stagiaire','Qualité du stagiaire','text'],['matricule_stagiaire','Matricule / numéro du stagiaire','text'],['niveau_recrutement','Niveau de recrutement / niveau d’études','text'],['date_debut','Date de début du stage','date'],['date_fin','Date de fin du stage','date'],['lettre_mise_stage_numero','N° de la lettre de mise en stage','text'],['lettre_mise_stage_date','Date de la lettre de mise en stage','date']]}}},
  convocations:{title:'Convocations',singular:'Convocation',subtitle:'Registre, édition des convocations administratives et procès-verbaux des rencontres.',fields:[['civilite','Civilité (M./Mme/Mlle)','select','M.|Mme|Mlle'],['profession','Profession','text'],['domicile','Domicile','text'],['date_presentation','Date de présentation','date'],['heure','Heure de présentation','time'],['objet_convocation','Objet de la convocation','textarea'],['personne_a_voir','Personne à voir','text']],pvSingular:'Procès-verbal de rencontre',pvFields:[['convocation_reference','Référence de la convocation','text'],['profession','Profession / qualité','text'],['domicile','Domicile','text'],['date_rencontre','Date de la rencontre','date'],['heure_debut','Heure de début','time'],['heure_fin','Heure de fin','time'],['lieu_rencontre','Lieu de la rencontre','text'],['objet_rencontre','Objet de la rencontre','textarea'],['personne_a_voir','Responsable / personne ayant reçu le convoqué','text'],['personnes_presentes','Personnes présentes / participants','textarea'],['resume_echanges','Déroulement / résumé des échanges','textarea'],['conclusions_decisions','Conclusions / décisions arrêtées','textarea'],['observations','Observations complémentaires','textarea']]},
  missions:{title:'Missions',singular:'Mission',subtitle:'Missions, équipes, objectifs, résultats et rapports.',fields:[],missionTypes:{
    DISPOSITION:{label:'Disposition des missions de contrôle',singular:'Disposition de mission de contrôle',addLabel:'Ajouter disposition',backendModule:'missions',fields:[
      ['libelle_mission','Libellé de la mission','text'],['frequence','Fréquence dans le temps','text']
    ]},
    REALISEE:{label:'Missions de contrôle réalisées',singular:'Mission de contrôle réalisée',addLabel:'Ajouter mission réalisée',backendModule:'missions',fields:[
      ['libelle_mission','Libellé de la mission','mission-select'],['libelle_mission_autre','Préciser « autre » mission','text'],['numero_mission','N° de la mission','computed-text'],['chef_mission','Chef de mission','agent-select'],['autres_agents_participants','Autres agents participants','textarea'],['objectif_mission','Objectif de la mission','textarea'],
      ['__section_moyens','Moyens mis à disposition','section'],['moyens_deplacement','Moyens de déplacement','text'],['immatriculation','Immatriculation','text'],['materiels_equipements','Matériels / équipements','textarea'],['resultat','Résultat','textarea'],['observations_particulieres','Observations particulières','textarea']
    ]},
    REPRESSION:{label:'Répression des infractions',singular:'Répression d’infraction',addLabel:'Ajouter répression',backendModule:'infractions',fields:[
      ['__section_liaison','Liée à une mission ?','section'],['liee_mission','Choix','select','oui|non'],['mission_liee_id','N° / intitulé de la mission','mission-realisee-select'],['_mission_chef','Chef de mission','computed-text'],['_mission_agents','Agent(s) de la mission','computed-textarea'],['agents_arrestation','Agent(s) ayant procédé à l’intervention','textarea'],
      ['__section_controle','Identification de la mission / opération de contrôle','section'],['date_controle','Date du contrôle','date'],['heure_controle','Heure du contrôle','time'],['lieu_controle','Lieu précis du contrôle','text'],['arrestation','Issue de l’intervention','select','une arrestation|aucune arrestation'],['objet_infraction','Objet / nature de l’infraction','textarea'],
      ['__section_personne','Identification de la personne mise en cause','section'],['personne_mise_cause','Nom et prénoms','text'],['contact_mis_cause','Contact','text'],['type_piece_identite','Type de pièce d’identité','select','CNI|Passeport|Permis|Autre'],['numero_piece_identite','Numéro de la pièce','text'],['domicile_mis_cause','Domicile / Localité','text'],
      ['__section_saisie','Objets, produits ou matériels saisis','section'],['objets_saisis','Les objets saisis','textarea'],['produits_saisis','Les produits saisis','textarea'],['materiels_saisis','Les matériels saisis','textarea'],['sort_biens','Sort des biens saisis','select','mis sous scellés|déposés à|confiés à|conservés à|autre'],['lieu_conservation','Lieu de dépôt / conservation ou responsable','text'],
      ['__section_faits','Exposé des faits','section'],['expose_faits','Circonstances et déroulement des faits','textarea'],
      ['__section_declaration','Déclaration de la personne mise en cause','section'],['declaration_mis_cause','Déclaration recueillie','textarea'],
      ['__section_constatations','Constatations des agents','section'],['constatations','Constatations matérielles et administratives','textarea'],
      ['__section_observations','Observations','section'],['observations','Observations complémentaires','textarea'],
      ['__section_suite','Conclusion et suite donnée','section'],['resume_infraction','Résumé de la nature de l’infraction','textarea'],['mesures_prises','Mesures prises / suite donnée','textarea'],['autorite_transmission','Service ou autorité compétente destinataire','text']
    ]}
  },offensePvFields:[
    ['__section_affaire','Informations automatiques reprises de l’affaire liée','section'],['mission_reference_affichage','N° / intitulé de la mission','computed-text'],['date_controle','Date du contrôle','computed-text'],['heure_controle','Heure du contrôle','computed-text'],['lieu_controle','Lieu précis du contrôle','computed-text'],['_mission_chef','Chef de mission','computed-text'],['_mission_agents','Agent(s) de la mission / intervention','computed-textarea'],['arrestation','Issue de l’intervention','computed-text'],
    ['__section_personne','Identification de la personne mise en cause','section'],['contact_mis_cause','Contact','computed-text'],['type_piece_identite','Type de pièce d’identité','computed-text'],['numero_piece_identite','Numéro de la pièce','computed-text'],['domicile_mis_cause','Domicile / Localité','computed-text'],
    ['__section_objet','Objet de l’infraction','section'],['objet_infraction','Objet / nature de l’infraction','computed-textarea'],
    ['__section_saisie','Objets, produits ou matériels concernés','section'],['objets_saisis','Les objets saisis','computed-textarea'],['produits_saisis','Les produits saisis','computed-textarea'],['materiels_saisis','Les matériels saisis','computed-textarea'],['sort_biens','Sort des biens saisis','computed-text'],['lieu_conservation','Lieu de dépôt / conservation ou responsable','computed-text'],
    ['__section_redaction','Rédaction du procès-verbal','section'],['expose_faits','Exposé des faits','textarea'],['constatations','Constatations','textarea'],['declaration_mis_cause','Déclaration de la personne mise en cause','textarea'],['observations_pv','Observations','textarea'],['resume_infraction','Résumé de la nature de l’infraction','textarea'],['mesures_prises','Mesures prises / suite donnée','textarea'],['autorite_transmission','Service ou autorité compétente destinataire','text']
  ]},
  controles:{title:'Contrôles',singular:'Contrôle',subtitle:'Suivi des contrôles et opérations de terrain.',fields:[['type','Type de contrôle','text'],['lieu','Lieu','text'],['equipe','Équipe','textarea'],['resultat','Résultat','textarea']]},
  infractions:{title:'Infractions',singular:'Infraction',subtitle:'Dossiers d’infractions et suites administratives.',fields:[['personne','Personne mise en cause','text'],['nature','Nature de l’infraction','text'],['lieu','Lieu','text'],['circonstances','Circonstances','textarea'],['mesures','Mesures prises','textarea']]},
  saisies:{title:'Saisies',singular:'Saisie',subtitle:'Inventaire et suivi des produits ou objets saisis.',fields:[['dossier','Dossier lié','text'],['designation','Désignation principale','text'],['quantite','Quantité totale','number'],['lieu_conservation','Lieu de conservation','text'],['observations','Observations','textarea']]},
  'exploitation-forestiere':{title:'Exploitation forestière',singular:'Enregistrement forestier',subtitle:'Recherche parcellaire, pépinières, plantations forestières créées et suivi des reboisements.',fields:[],exploitationTypes:{
    RECHERCHE_PARCELLAIRE:{label:'Recherche parcellaire',singular:'Recherche parcellaire',addLabel:'Ajouter recherche parcellaire',fields:[
      ['sous_prefecture','Sous-préfecture','text'],['date_activite','Date','date'],['localite','Localité','text'],['essence','Essence','text'],['superficie_parcelle','Superficie de la parcelle (ha)','number'],['coord_x','Coordonnée X de la parcelle','text'],['coord_y','Coordonnée Y de la parcelle','text'],['contact_proprietaire','Contacts du propriétaire','text']
    ]},
    PEPINIERE:{label:'Situation de la pépinière',singular:'Situation de la pépinière',addLabel:'Ajouter situation de la pépinière',fields:[
      ['localisation','Localisation','text'],['date_activite','Date','date'],['sous_prefecture','Sous-préfecture','text'],['coord_x','Coordonnée X de la parcelle','text'],['coord_y','Coordonnée Y de la parcelle','text'],['essence','Essence','text'],['nbr_plants_produits','Nbr. de plants produits','number'],['nbr_plants_distribues','Nbr. de plants distribués','computed'],['nbr_plants_disponibles','Nbr. de plants disponibles','computed'],['contact_responsable','Contacts du responsable','text']
    ]},
    PLANTATION_CREEE:{label:'Plantations forestières créées',singular:'Plantation forestière créée',addLabel:'Ajouter plantation forestière',fields:[
      ['date_activite','Date','date'],['localite','Localité','text'],['beneficiaire','Nom bénéficiaire','text'],['contact_beneficiaire','Contact bénéficiaire','text'],['superficie','Superficie (ha)','number'],['essence','Essence','text'],['densite','Densité (pieds/ha)','number'],['nombre_total_plants','Nombre total de plants','number'],['coord_x','Coordonnée X','text'],['coord_y','Coordonnée Y','text']
    ]},
    REBOISEMENT:{label:'Reboisement',singular:'Reboisement',addLabel:'Ajouter reboisement',fields:[
      ['type_reboisement','Type de reboisement','select','particuliers suivis|agro forestiers suivis|antérieurs suivis|compensatoires suivis'],['date_activite','Date','date'],['localite','Localité','text'],['beneficiaire','Nom bénéficiaire','text'],['contact_beneficiaire','Contact bénéficiaire','text'],['superficie','Superficie (ha)','number'],['essence','Essence','text'],['densite','Densité (pieds/ha)','number'],['nombre_total_plants','Nombre total de plants','number'],['coord_x','Coordonnée X','text'],['coord_y','Coordonnée Y','text'],['entreprise_responsable','Entreprise responsable du reboisement','text']
    ]}
  }},
  'produits-secondaires':{title:'Produits secondaires',singular:'Opérateur',subtitle:'Exploitants et productions des produits secondaires.',fields:[['operateur','Nom de l’opérateur','text'],['contact','Contact','text'],['produit','Produit exploité','text'],['permis','N° permis','text'],['localite','Localité','text']]},
  'transformation-bois':{title:'Transformation du bois',singular:'Enregistrement',subtitle:'Unités de transformation du bois, déligneuses, menuiseries et dépôts-ventes.',fields:[],woodTypes:{
    EXPLOITANTS_SECONDAIRES:{label:'Exploitants de produits secondaires',singular:'Exploitant de produits secondaires',addLabel:'Ajouter exploitant',fields:[
      ['nom_operateur','Nom et prénoms (opérateur)','text'],['contact','Contact','text'],['nature_produit','Nature du produit exploité','text'],
      ['__section_autorisation','Références de l’autorisation','section'],['numero_permis','N° du permis','text'],['date_delivrance','Date de délivrance','date'],['localite','Localité','text'],['service_suivi','Service forestier en charge du suivi','text']
    ]},
    PRODUITS_QTE:{label:'Qté de produits secondaires exploités',singular:'Quantité de produits secondaires exploités',addLabel:'Ajouter quantité exploitée',fields:[
      ['statut_operateur','Statut de l’opérateur','select','agréés|non agréés'],
      ['__section_charbon','Charbon de bois','section'],['charbon_qte_sacs','Qté (sac)','number'],['charbon_nbr_carnet','Nbr carnet','number'],
      ['__section_bois_feu','Bois de feu','section'],['bois_feu_qte_t','Qté (T)','number'],['bois_feu_nbr_carnet','Nbr carnet','number'],
      ['__section_mortiers','Mortiers','section'],['mortiers_qte_t','Qté (T)','number'],['mortiers_nbr_carnet','Nbr carnet','number'],
      ['__section_kinkeliba','Kinkeliba','section'],['kinkeliba_qte_t','Qté (T)','number'],['kinkeliba_nbr_carnet','Nbr carnet','number'],
      ['__section_karite','Fruit de karité','section'],['karite_qte_t','Qté (T)','number'],['karite_nbr_carnet','Nbr carnet','number'],
      ['__section_bambou','Bambou de chine','section'],['bambou_qte_t','Qté (T)','number'],['bambou_nbr_carnet','Nbr carnet','number']
    ]},
    UNITES_BOIS:{label:'Les unités de transformation du bois',singular:'Unité / exerçant du bois',addLabel:'Ajouter unité / exerçant',fields:[
      ['type_exercant','Type d’exerçant','select','unités de transformation|déligneuses|menuiseries|dépôts-ventes'],
      ['region','Région','text'],['departement','Département','text'],['localite','Localité','text'],['nom_usine','Nom de l’usine','text'],['activites_principales','Activités principales','textarea'],['nom_operateur','Nom et Prénoms de l’opérateur','text'],['contact_operateur','Contact de l’opérateur','text'],['coord_x','Coordonnée X','text'],['coord_y','Coordonnée Y','text'],['service_rattachement','Service forestier de rattachement','text'],
      ['__section_autorisation','Références de l’autorisation','section'],['numero_permis','N° du permis','text'],['date_delivrance','Date de délivrance','date']
    ]}
  }},
  'activites-minef':{title:'Activités du MINEF',singular:'Activité',subtitle:'Suivi des activités menées au sein du MINEF et des activités externes au MINEF.',fields:[['type_activite','Type d’activité','select','activités du MINEF|activités externes au MINEF'],['categorie_minef','Cadre de l’activité MINEF','select','Au sein du MINEF|Projets du MINEF dans la région|Structures sous tutelle du MINEF dans la région'],['date_activite','Date de l’activité','date'],['intitule_activite','Intitulé de l’activité','text'],['organisateur','Organisateur','text'],['commentaire','Commentaire','textarea']]},
  sensibilisations:{title:'Sensibilisations',singular:'Sensibilisation',subtitle:'Actions de sensibilisation et statistiques par sexe.',fields:[['type_sensibilisation','Type de sensibilisation','select','sensibilisations des opérateurs|sensibilisations en matière d’agroforesterie|sensibilisations contre les feux de brousse|sensibilisations sur la gestion de l’eau|sensibilisations sur la faune|sensibilisations sur les lois et textes réglementaires'],['date_activite','Date d’activité','date'],['lieu','Lieu','text'],['cible','Cible','text'],['hommes','Nombre d’hommes sensibilisés','number'],['femmes','Nombre de femmes sensibilisées','number'],['agent_charge','Agent en charge','text'],['observations','Observations','textarea']]},
  reboisement:{title:'Reboisement',singular:'Plantation',subtitle:'Plantations, bénéficiaires, superficies, essences et plants.',fields:[['localite','Localité','text'],['beneficiaire','Bénéficiaire','text'],['superficie','Superficie (ha)','number'],['essences','Essences','text'],['densite','Densité','number'],['plants','Nombre de plants','number'],['coordonnees','Coordonnées X/Y','text']]},
  'ressources-naturelles':{title:'Ressources naturelles',singular:'Ressource',subtitle:'Forêts, aires protégées et ressources en eau.',fields:[['type','Type','select','Relique de forêt|Forêt classée|Aire protégée|Plan d’eau|Autre'],['localite','Localité','text'],['superficie','Superficie (ha)','number'],['coordonnees','Coordonnées','text'],['observations','Observations','textarea']]},
  'feux-brousse':{title:'Feux de brousse',singular:'Enregistrement feux de brousse',subtitle:'Sinistres, dégâts et suivi des incidents.',fields:[],fireTypes:{
    REDYNAMISE:{label:'Comités de lutte contre les feux de brousse redynamisés',singular:'Comité redynamisé',addLabel:'Ajouter comité redynamisé',fields:[['departement','Département','text'],['sous_prefecture','Sous-préfecture','text'],['village','Nom du village','created-fire-select'],['acte_creation','N° de l’Acte','text'],['__section_president','Président du comité','section'],['president_nom','Nom et prénoms','text'],['president_contact','Contact','text']]},
    CREE:{label:'Comités de lutte contre les feux de brousse créés',singular:'Comité créé',addLabel:'Ajouter comité créé',fields:[['departement','Département','text'],['sous_prefecture','Sous-préfecture','text'],['village','Nom du village','text'],['acte_creation','Acte de création','text'],['__section_president','Président du comité','section'],['president_nom','Nom et prénoms','text'],['president_contact','Contact','text']]},
    RENOUVELE:{label:'Comités de lutte contre les feux de brousse renouvelés',singular:'Comité renouvelé',addLabel:'Ajouter comité renouvelé',fields:[['departement','Département','text'],['sous_prefecture','Sous-préfecture','text'],['village','Nom du village','created-fire-select'],['acte_creation','N° de l’Acte','text'],['__section_president','Président du comité','section'],['president_nom','Nom et prénoms','text'],['president_contact','Contact','text']]},
    DEGATS:{label:'Liste des dégâts des feux de brousse enregistrés',singular:'Dégât de feu de brousse',addLabel:'Ajouter dégât enregistré',fields:[['__section_localisation','Localisation du feu','section'],['sous_prefecture','Sous-préfecture','text'],['village','Nom du village','text'],['date_constat','Date du constat du feu','date'],['nature_degats','Nature des dégâts','textarea'],['superficie_detruite','Superficie détruite (ha)','number'],['personnes_impactees','Nom et prénoms des personnes impactées','textarea'],['observations','Observations','textarea']]}
  }},
  faune:{title:'Faune',singular:'Enregistrement faune',subtitle:'Observations des espèces et zones d’observation.',fields:[],faunaTypes:{
    OBSERVATIONS:{label:'Point des animaux rencontrés',singular:'Observation animale',addLabel:'Ajouter observation',fields:[['date_observation','Date d’observation','date'],['especes_animales','Espèces animales rencontrées','text'],['zone_observation','Zone d’observation (terroir)','text'],['commentaires_utiles','Commentaires utiles','textarea']]},
    CONFLITS:{label:'Gestion des conflits homme-faune',singular:'Conflit homme-faune',addLabel:'Ajouter conflit homme-faune',fields:[['__section_localisation','Localisation du conflit','section'],['sous_prefecture','S/Préfecture','text'],['village','Village','text'],['type_conflit','Type de conflit','text'],['nombre_animaux','Nombre d’animaux impliqués','number'],['degats_recenses','Dégâts recensés','textarea'],['__section_impactes','Nombre de personnes impactées','section'],['hommes_impactes','Homme','number'],['femmes_impactees','Femme','number'],['action_menee','Action menée','textarea']]}
  }},
  formations:{title:'Formations',singular:'Formation',subtitle:'Renforcement des capacités des agents.',fields:[['date_activite','Date de l’activité','date'],['theme','Thème de la formation','select','Gouvernance forestière (politiques, stratégies, lois et textes règlementaires)|Développement forestier (cartographie, utilisation du GPS, SIG, reboisement, etc.)|Gestion des ressources forestières|Gestion des ressources en eau, surveillance des plans et cours d’eau, etc.|Gestion des ressources fauniques (conflit homme-faune, lutte contre le braconnage et le trafic des espèces de faunes, connaissance de la faune etc.)|autres (à préciser)'],['theme_autre','Autre thème à préciser','text'],['__section_agents','Nombre d’agents formés','section'],['hommes','Homme','number'],['femmes','Femme','number'],['observations','Observations générales','textarea']]},
  materiel:{title:'Matériel et patrimoine',singular:'Équipement',subtitle:'Matériel roulant, informatique, mobilier et équipements techniques.',fields:[['categorie','Catégorie','text'],['marque','Marque','text'],['numero','N° immatriculation / marquage','text'],['etat','État','select','Neuf|Bon|Passable|Mauvais|Hors service'],['responsable','Responsable','text']]},
  finances:{title:'Finances',singular:'Ligne budgétaire',subtitle:'Prévisions, exécution et suivi budgétaire.',fields:[['montant_prevu','Montant prévu (FCFA)','number'],['montant_execute','Montant exécuté (FCFA)','number'],['observations','Observations','textarea']]},
  rapports:{title:'Rapports et bilans',singular:'Rapport',subtitle:'Bilans mensuels, trimestriels, semestriels et annuels.',fields:[['type','Type','select','Mensuel|Trimestriel|Semestriel|Annuel|Mission|Autre'],['periode','Période','text'],['conclusion','Conclusion','textarea']]},
  archives:{title:'Archives',singular:'Archive',subtitle:'Classement et recherche des documents archivés.',fields:[['type','Type d’archive','text'],['annee','Année','number'],['mot_cle','Mot-clé','text'],['description','Description','textarea']]}
};
