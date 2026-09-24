import { getDb } from './database.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database with schema
const db = getDb();
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
}

const rawData = `
**1 SAMUEL:**
Ch1: Ana (esposa de Elcana) era estéril, oraba en el templo de Silo, Elí pensó que estaba borracha, Dios le concedió un hijo llamado Samuel, lo dedicó al servicio en el templo
Ch2: Cántico de Ana sobre la grandeza de Dios, Ofni y Finees (hijos de Elí) eran sacerdotes corruptos, robaban las ofrendas, profecía contra la casa de Elí
Ch3: Samuel servía a Elí en Silo, Dios llamó a Samuel 3 veces de noche, Elí le dijo que respondiera "Habla Señor, tu siervo oye", Dios reveló juicio contra Elí
Ch4: Israel peleó contra filisteos en Eben-ezer, llevaron el arca al campo de batalla, filisteos capturaron el arca, Ofni y Finees murieron, Elí cayó y murió al oír la noticia, nació Icabod
Ch5: El arca fue puesta junto a Dagón en Asdod, Dagón cayó ante el arca, los de Asdod tuvieron tumores, movieron el arca a Gat y luego a Ecrón
Ch6: Filisteos devolvieron el arca con 5 tumores de oro y 5 ratones de oro, en un carro nuevo tirado por vacas, el arca llegó a Bet-semes, hombres murieron por mirar dentro del arca
Ch7: El arca estuvo 20 años en Quiriat-jearim, Samuel llamó a Israel a arrepentirse, quitaron los baales y astarot, derrotaron a filisteos en Mizpa, Samuel levantó piedra Ebenezer
Ch8: Samuel era viejo, sus hijos Joel y Abías eran jueces corruptos, el pueblo pidió un rey como las naciones, Dios le dijo a Samuel que les advirtiera sobre los derechos del rey
Ch9: Saúl era hijo de Cis, de la tribu de Benjamín, alto y apuesto, buscaba las asnas perdidas de su padre, su siervo sugirió consultar al vidente Samuel, Samuel preparó un banquete para él
Ch10: Samuel ungió a Saúl con aceite, le dio 3 señales: encontraría hombres en Selsa, le darían panes en la encina de Tabor, profetizaría con profetas, fue elegido rey por sorteo en Mizpa
Ch11: Nahas amonita sitió Jabes de Galaad, quería sacarles el ojo derecho, el Espíritu vino sobre Saúl, reunió ejército con amenaza de los bueyes cortados, derrotó a los amonitas, renovaron el reino en Gilgal
Ch12: Samuel recordó su integridad, repasó la historia de Israel desde Egipto, advirtió sobre las consecuencias de tener rey, pidió lluvia y truenos como señal, pueblo reconoció su pecado
Ch13: Jonatán atacó la guarnición filistea en Geba, filisteos reunieron 30,000 carros, Saúl esperó 7 días a Samuel en Gilgal, no esperó y ofreció holocausto él mismo, Samuel dijo que su reino no permanecería, solo 600 hombres quedaron, no había herrero en Israel
Ch14: Jonatán y su paje atacaron solos a los filisteos, mataron a 20 en media yugada, Dios envió temblor, Saúl juró maldición sobre quien comiera, Jonatán comió miel sin saberlo, el pueblo rescató a Jonatán
Ch15: Dios ordenó a Saúl destruir totalmente a los amalecitas y a su rey Agag, Saúl perdonó a Agag y guardó lo mejor del ganado, Samuel dijo "obedecer es mejor que sacrificio", Dios rechazó a Saúl como rey, Samuel mató a Agag
Ch16: Dios envió a Samuel a Belén, a la casa de Isaí, Samuel ungió a David (el menor, pelirrojo, pastor), un espíritu malo atormentaba a Saúl, David fue llevado a tocar el arpa para calmarlo
Ch17: Goliat era filisteo de Gat, medía 6 codos y un palmo (~2.9m), desafiaba a Israel 40 días, David era pastor y llevaba comida a sus hermanos, David venció a Goliat con una honda y 5 piedras lisas del arroyo, lo decapitó con su propia espada
Ch18: Jonatán hizo pacto de amistad con David, le dio su manto y armas, las mujeres cantaban "Saúl hirió a sus miles, David a sus diez miles", Saúl celoso, lanzó la lanza a David 2 veces, David se casó con Mical hija de Saúl por 200 prepucios de filisteos
Ch19: Saúl ordenó matar a David, Jonatán intercedió, Saúl lanzó lanza otra vez, Mical ayudó a David a escapar por una ventana, puso un ídolo en la cama, David huyó a Samuel en Ramá, mensajeros de Saúl profetizaron, Saúl también profetizó desnudo
Ch20: David pidió a Jonatán averiguar la intención de Saúl, señal de las flechas, fiesta de luna nueva, Saúl se enfureció y lanzó lanza a Jonatán, Jonatán y David lloraron juntos, hicieron pacto de amistad eterna
Ch21: David huyó a Nob, el sacerdote Ahimelec le dio los panes de la proposición, también le dio la espada de Goliat, David huyó a Aquis rey de Gat, fingió estar loco para escapar
Ch22: David fue a la cueva de Adulam, reunió 400 hombres, llevó a sus padres a Moab, profeta Gad, Doeg el edomita delató a Ahimelec, Saúl ordenó matar a 85 sacerdotes de Nob, Abiatar escapó a David
Ch23: David salvó la ciudad de Keila de los filisteos, Dios le dijo que los de Keila lo entregarían, huyó al desierto de Zif, los zifeos delataron a David, Saúl lo persiguió, David escapó por ataque filisteo
Ch24: Saúl entró a una cueva en En-gadi, David cortó un pedazo de su manto sin matarlo, David mostró el manto a Saúl desde lejos, Saúl reconoció que David era más justo, lloró y dijo que David sería rey
Ch25: Samuel murió y fue sepultado en Ramá, Nabal era rico y necio en Carmelo, su esposa Abigail era sabia, David iba a matar a Nabal, Abigail trajo provisiones y calmó a David, Nabal murió 10 días después de un ataque, David se casó con Abigail
Ch26: Los zifeos delataron a David otra vez, David y Abisai entraron al campamento de Saúl de noche, David tomó su lanza y jarro de agua mientras dormía, no lo mató, Saúl reconoció su pecado desde lejos
Ch27: David se refugió con Aquis rey de Gat, le dio la ciudad de Siclag, David vivió 1 año y 4 meses, hacía incursiones contra otros pueblos pero decía a Aquis que atacaba a Judá
Ch28: Filisteos se reunieron contra Israel, Samuel había muerto, Saúl no recibió respuesta de Dios, fue disfrazado a una adivina en Endor, ella hizo subir a Samuel, Samuel le dijo que moriría al día siguiente con sus hijos
Ch29: Los príncipes filisteos no confiaron en David, Aquis lo envió de vuelta, David no peleó contra Israel
Ch30: Amalecitas atacaron Siclag, quemaron la ciudad, se llevaron a las mujeres e hijos, David consultó a Dios y los persiguió, encontró un egipcio esclavo que lo guió, David recuperó todo, repartió equitativamente el botín
Ch31: Filisteos derrotaron a Israel en Gilboa, Jonatán, Abinadab y Malquisúa (hijos de Saúl) murieron, Saúl herido por flecheros se suicidó cayendo sobre su espada, filisteos colgaron cuerpos en Bet-sán, hombres de Jabes de Galaad rescataron los cuerpos

**2 SAMUEL:**
Ch1: Un amalecita trajo noticias de la muerte de Saúl, dijo que él lo mató (mintió), David lo ejecutó, David compuso el lamento "Cántico del Arco" sobre Saúl y Jonatán, "¡Cómo han caído los valientes!"
Ch2: David fue ungido rey de Judá en Hebrón, Abner hizo rey a Is-boset sobre Israel, batalla de Gabaón junto al estanque, Asael persiguió a Abner, Abner lo mató, Joab hermano de Asael
Ch3: Guerra larga entre la casa de David y la casa de Saúl, David se fortalecía, Abner se enojó con Is-boset por Rizpa, Abner negoció con David, Joab mató a Abner en Hebrón por venganza de Asael, David maldijo a Joab
Ch4: Recab y Baana (capitanes) asesinaron a Is-boset mientras dormía, le cortaron la cabeza y la llevaron a David, David los ejecutó por matar a un inocente, colgó sus manos y pies
Ch5: Tribus de Israel vinieron a David en Hebrón, lo ungieron rey de todo Israel (tenía 30 años), reinó 40 años total (7 en Hebrón, 33 en Jerusalén), conquistó Jerusalén de los jebuseos (fortaleza de Sion), Hiram de Tiro envió materiales
Ch6: David trasladó el arca desde Baala de Judá, en un carro nuevo, Uza tocó el arca cuando los bueyes tropezaron y murió, David tuvo miedo, el arca quedó 3 meses en casa de Obed-edom, David danzó con todas sus fuerzas, Mical lo despreció
Ch7: David quiso construir templo, Dios dijo que no (su hijo lo haría), Pacto Davídico: trono eterno, Dios le sería padre al hijo de David, David oró agradeciendo
Ch8: David derrotó a filisteos, moabitas, Hadadezer de Soba, sirios de Damasco, edomitas, reinaba con justicia, oficiales: Joab (ejército), Josafat (cronista), Sadoc y Ahimelec (sacerdotes)
Ch9: David preguntó si quedaba alguien de la casa de Saúl, Siba (siervo) le dijo de Mefiboset hijo de Jonatán, estaba lisiado de ambos pies (caído a los 5 años), David le devolvió tierras y lo sentó a su mesa siempre
Ch10: El rey Nahas de Amón murió, David envió mensajeros de condolencia a Hanún su hijo, Hanún los humilló (rapó media barba, cortó vestidos), amonitas contrataron sirios, Joab y Abisai los derrotaron
Ch11: David vio a Betsabé bañándose desde la terraza, era esposa de Urías heteo, David la tomó y quedó embarazada, intentó que Urías fuera a casa pero él no fue (por honor), David ordenó poner a Urías al frente de la batalla, Urías murió, David se casó con Betsabé
Ch12: Profeta Natán confrontó a David con parábola del cordero, David dijo "ese hombre merece la muerte", Natán dijo "tú eres ese hombre", David confesó "Pequé contra Jehová", el primer hijo de Betsabé murió en 7 días, luego nació Salomón, Joab tomó Rabá de Amón
Ch13: Amnón (hijo de David) se obsesionó con su media hermana Tamar, Jonadab le aconsejó fingir enfermedad, Amnón violó a Tamar, luego la aborreció, Absalón odió a Amnón, 2 años después Absalón mató a Amnón en fiesta de esquileo, Absalón huyó a Gesur
Ch14: Joab usó a una mujer sabia de Tecoa con una parábola, convenció a David de traer a Absalón de vuelta, Absalón regresó pero 2 años sin ver al rey, Absalón era muy hermoso con cabello largo, prendió fuego al campo de Joab para que lo llevara al rey, David besó a Absalón
Ch15: Absalón se ganó al pueblo en la puerta de la ciudad durante 4 años, conspiró en Hebrón, David huyó de Jerusalén llorando, subió el monte de los Olivos descalzo, Husai fue enviado como espía, Sadoc y Abiatar quedaron con el arca en Jerusalén
Ch16: Siba (siervo de Mefiboset) trajo provisiones y mintió diciendo que Mefiboset esperaba el trono, Simei de la casa de Saúl maldijo a David y le tiró piedras, Abisai quería matarlo pero David lo permitió, Absalón entró en Jerusalén, Ahitofel aconsejó
Ch17: Ahitofel aconsejó perseguir a David esa noche con 12,000 hombres, Husai aconsejó esperar y reunir todo Israel (su consejo era para dar tiempo a David), Absalón siguió a Husai, Husai envió mensaje a David por los sacerdotes, Ahitofel se suicidó ahorcándose
Ch18: David organizó ejército en 3 divisiones (Joab, Abisai, Itai), David pidió que trataran con suavidad a Absalón, batalla en el bosque de Efraín, 20,000 murieron, Absalón quedó colgado por el cabello en una encina, Joab le clavó 3 dardos, David lloró "¡Hijo mío Absalón!"
Ch19: Joab reprendió a David por llorar, David regresó, cruzó el Jordán, perdonó a Simei, Mefiboset explicó que Siba mintió, David dividió tierras, Barzilai de Galaad despidió a David, disputa entre Judá e Israel
Ch20: Seba hijo de Bicri (benjamita) se rebeló, David envió a Amasa (luego Joab lo mató), Joab persiguió a Seba hasta Abel-bet-maaca, una mujer sabia negoció y cortaron la cabeza de Seba
Ch21: Hambruna de 3 años por culpa de Saúl (masacre de gabaonitas), David entregó 7 descendientes de Saúl, Rizpa veló por los cuerpos, guerra contra gigantes filisteos, Isbi-benob intentó matar a David
Ch22: Cántico de David (similar al Salmo 18), Dios como roca, fortaleza, libertador, Dios lo rescató de enemigos, recompensó su justicia
Ch23: Últimas palabras de David, "El Espíritu de Jehová ha hablado por mí", lista de los 3 valientes principales: Joseb-basebet, Eleazar, Sama; los 30 valientes, Urías el heteo está en la lista
Ch24: David ordenó censar al pueblo (pecado de orgullo), Joab resistió pero obedeció, 800,000 en Israel y 500,000 en Judá, Dios ofreció 3 castigos (7 años hambruna, 3 meses huir, 3 días peste), David eligió la pestilencia, murieron 70,000, David compró la era de Arauna el jebuseo por 50 siclos de plata

**1 REYES:**
Ch1: David era anciano, Abisag sunamita lo cuidaba, Adonías (hijo de David) se autoproclamó rey con apoyo de Joab y Abiatar, Natán y Betsabé hablaron con David, David ordenó ungir a Salomón, montado en la mula del rey, ungido por Sadoc en Gihón
Ch2: David dio instrucciones finales a Salomón (ser fuerte, guardar los mandamientos, castigar a Joab y Simei, recompensar a Barzilai), David murió tras 40 años de reinado, Adonías pidió a Abisag y fue ejecutado, Joab fue muerto por Benaía en el altar, Abiatar desterrado, Simei mató cuando desobedeció
Ch3: Salomón se casó con la hija de Faraón, Dios le apareció en sueño en Gabaón, Salomón pidió sabiduría (corazón entendido), Dios le dio también riqueza y honra, juicio sabio de las 2 madres y el niño vivo ("Partid al niño por la mitad")
Ch4: 12 gobernadores administraban Israel, Salomón tenía 40,000 caballos, su sabiduría superaba a todos, compuso 3,000 proverbios y 1,005 cánticos, gente venía de todos los reinos
Ch5: Hiram rey de Tiro envió siervos, Salomón pidió madera de cedro y ciprés del Líbano, a cambio dio trigo y aceite, 30,000 obreros iban al Líbano por turnos, 70,000 cargadores y 80,000 cortadores
Ch6: Templo comenzó en el año 4 de Salomón (480 años después del Éxodo), medía 60 codos largo × 20 ancho × 30 alto, recubierto de oro, lugar santísimo 20×20 con 2 querubines de olivo de 10 codos, construcción duró 7 años
Ch7: Palacio de Salomón tardó 13 años, Casa del Bosque del Líbano, Hiram de Tiro hizo 2 columnas de bronce: Jaquín y Boaz, el mar de bronce sobre 12 bueyes, 10 basas y 10 fuentes de bronce
Ch8: Salomón dedicó el templo, el arca fue traída al lugar santísimo, la nube de gloria llenó el templo, Salomón oró de rodillas, pidió que Dios escuchara oraciones dirigidas al templo, sacrificó 22,000 bueyes y 120,000 ovejas, fiesta de 14 días
Ch9: Dios se apareció a Salomón por 2da vez, prometió bendición si obedecía, advirtió destrucción si desobedecía, Salomón dio 20 ciudades a Hiram (no le gustaron, las llamó Cabul), construyó flota en Ezión-geber
Ch10: Reina de Sabá visitó a Salomón con especias, oro y piedras preciosas, probó su sabiduría con preguntas difíciles, "ni la mitad me fue dicha", Salomón recibía 666 talentos de oro al año, trono de marfil con 12 leones, vasos de oro
Ch11: Salomón amó a 700 mujeres principales y 300 concubinas, extranjeras, ellas desviaron su corazón a dioses falsos (Astoret, Milcom, Quemos), Dios se enojó, levantó adversarios: Hadad edomita, Rezón de Siria, Ahías profetizó a Jeroboam (rompió manto en 12 pedazos, le dio 10)
Ch12: Roboam fue a Siquem, pueblo pidió aliviar cargas, ancianos aconsejaron ceder, jóvenes aconsejaron dureza, Roboam siguió a los jóvenes ("mi padre los azotó con látigos, yo con escorpiones"), 10 tribus se separaron con Jeroboam, Jeroboam hizo 2 becerros de oro en Dan y Bet-el
Ch13: Un varón de Dios de Judá profetizó contra el altar de Bet-el (nombrando a Josías), la mano de Jeroboam se secó, el altar se rompió, Dios le dijo que no comiera ni bebiera allí, un viejo profeta lo engañó, un león lo mató en el camino por desobedecer
Ch14: Hijo de Jeroboam enfermó, su esposa fue disfrazada a Ahías el profeta (que estaba ciego), Ahías la reconoció y profetizó destrucción de la casa de Jeroboam, el niño murió, Jeroboam reinó 22 años, Roboam reinó en Judá 17 años, Sisac de Egipto invadió
Ch15: Abiam reinó 3 años en Judá (malo), Asa reinó 41 años en Judá (bueno, quitó ídolos, destituyó a su abuela Maaca), Nadab hijo de Jeroboam reinó 2 años, Baasa lo mató y reinó 24 años
Ch16: Jehú profetizó contra Baasa, Ela hijo de Baasa reinó 2 años, Zimri lo mató (reinó solo 7 días, se quemó en su palacio), Omri venció a Tibni, fundó Samaria, fue malo, Acab hijo de Omri fue peor que todos, se casó con Jezabel, sirvió a Baal
Ch17: Elías el tisbita anunció sequía, Dios lo envió al arroyo de Querit (cuervos lo alimentaban con pan y carne), luego a Sarepta con una viuda, la harina y el aceite no se acabaron, el hijo de la viuda murió y Elías lo resucitó
Ch18: Sequía de 3 años, Abdías escondía profetas, Elías desafió a 450 profetas de Baal en Carmelo, Baal no respondió, Elías reparó altar con 12 piedras, mojó todo 3 veces, oró, cayó fuego del cielo, pueblo dijo "¡Jehová es Dios!", Elías mató a los profetas, lluvia vino
Ch19: Jezabel amenazó matar a Elías, huyó al desierto, un ángel lo alimentó 2 veces, caminó 40 días a Horeb, se escondió en una cueva, Dios no estaba en el viento, terremoto, ni fuego, sino en el silbo apacible y delicado, Dios dijo que había 7,000 que no se arrodillaron ante Baal, llamó a Eliseo que estaba arando con 12 yuntas de bueyes
Ch20: Ben-adad de Siria sitió Samaria, demandas excesivas, un profeta dijo que Dios daría victoria, Israel venció con 232 jóvenes líderes, Ben-adad atacó de nuevo en Afec, 100,000 sirios murieron, Acab perdonó a Ben-adad, un profeta lo condenó por perdonarlo
Ch21: Nabot tenía una viña junto al palacio de Acab en Jezreel, Nabot se negó a venderla (herencia), Jezabel tramó cartas con falsos testigos, acusaron a Nabot de blasfemia, lo apedrearon, Elías confrontó a Acab: "¿No mataste y también has despojado?", profetizó que los perros lamerían su sangre, Acab se humilló y Dios retrasó el castigo
Ch22: 3 años sin guerra, Josafat de Judá visitó a Acab, Micaías profetizó derrota, 400 profetas falsos dijeron victoria, Sedequías le dio bofetada a Micaías, Acab se disfrazó en batalla, una flecha al azar lo hirió, murió al atardecer, perros lamieron su sangre, Josafat reinó bien en Judá

**2 REYES:**
Ch1: Ocozías cayó por la ventana, envió a consultar a Baal-zebub de Ecrón, Elías interceptó a los mensajeros, 2 capitanes con 50 soldados subieron a Elías y fuego del cielo los consumió, el 3er capitán suplicó, Elías descendió, Ocozías murió sin hijo
Ch2: Elías y Eliseo cruzaron el Jordán (golpeó agua con manto), Elías subió al cielo en un carro de fuego con caballos de fuego y un torbellino, Eliseo tomó el manto, golpeó el Jordán y se abrió, 50 hombres buscaron a Elías 3 días sin encontrarlo, Eliseo sanó aguas de Jericó con sal, 42 muchachos se burlaron de Eliseo y 2 osas los despedazaron
Ch3: Joram de Israel, Josafat de Judá y rey de Edom fueron contra Moab, no había agua, Eliseo pidió un músico, profetizó agua y victoria, Moab derrotado, Mesa rey de Moab sacrificó a su hijo en el muro
Ch4: Viuda de un profeta con deuda, Eliseo multiplicó el aceite, la sunamita rica le dio una habitación, Eliseo prometió un hijo, el niño murió, Eliseo lo resucitó (se tendió sobre él), muerte en la olla sanada con harina, multiplicó 20 panes de cebada para 100 hombres
Ch5: Naamán era general sirio con lepra, una niña israelita cautiva le habló de Eliseo, Eliseo le dijo que se lavara 7 veces en el Jordán, Naamán se enojó pero obedeció y fue sanado, ofreció regalos que Eliseo rechazó, Giezi corrió y pidió regalos, Eliseo lo maldijo con la lepra de Naamán
Ch6: Hijos de profetas cortaban madera, un hacha cayó al Jordán, Eliseo hizo flotar el hierro con un palo, ejército sirio buscaba a Eliseo, Dios abrió ojos del siervo (montaña llena de carros de fuego), Eliseo pidió que Dios los cegara, los llevó a Samaria, les dio comida, Ben-adad sitió Samaria, hambruna terrible (cabeza de asno, palomino)
Ch7: Eliseo profetizó abundancia para el día siguiente, un oficial dudó ("aunque Jehová hiciera ventanas en el cielo"), 4 leprosos fueron al campamento sirio, estaba vacío (Dios hizo oír ruido de ejército), abundancia de comida, el oficial dudoso fue pisoteado en la puerta
Ch8: La sunamita regresó de Filistea (7 años), Giezi contó al rey sobre Eliseo, recuperó sus tierras, Eliseo lloró ante Hazael y profetizó males contra Israel, Hazael asfixió a Ben-adad y fue rey de Siria, Joram rey de Judá (malo, casado con hija de Acab), Edom se rebeló, Ocozías rey de Judá (malo)
Ch9: Eliseo envió a un joven profeta a ungir a Jehú como rey de Israel, Jehú fue en su carro, mató a Joram de Israel (flecha en el corazón, en la viña de Nabot), mató a Ocozías de Judá, Jezabel se pintó los ojos y se asomó, fue arrojada por la ventana, los perros comieron su cuerpo
Ch10: 70 hijos de Acab en Samaria fueron decapitados, Jehú destruyó toda la casa de Acab, reunió a adoradores de Baal con engaño en el templo y los mató a todos, destruyó el templo de Baal, pero no dejó los becerros de Dan y Bet-el, Hazael comenzó a cortar territorio de Israel
Ch11: Atalía (madre de Ocozías) mató a toda la descendencia real y reinó, Josaba (hermana de Ocozías) escondió al niño Joás con su nodriza en el templo 6 años, Joiada el sacerdote organizó golpe, coronaron a Joás a los 7 años, Atalía fue ejecutada, renovaron pacto con Dios
Ch12: Joás reinó 40 años en Judá (bien mientras vivió Joiada), ordenó reparar el templo, los sacerdotes no lo hacían, pusieron una caja/cofre junto al altar para recoger dinero, repararon el templo, Hazael atacó Jerusalén, Joás dio tesoros del templo, siervos conspiraron y mataron a Joás
Ch13: Joacaz reinó 17 años en Israel (malo), oprimido por Hazael, Joás de Israel reinó 16 años, visitó a Eliseo enfermo, Eliseo le dijo que disparara flechas, golpeó solo 3 veces (debió golpear 5-6), Eliseo murió, un muerto tocó los huesos de Eliseo y revivió
Ch14: Amasías de Judá reinó bien, mató a asesinos de su padre, derrotó a Edom en el Valle de la Sal (10,000), retó a Joás de Israel, fue derrotado, Joás rompió muro de Jerusalén 400 codos, Jeroboam II reinó en Israel 41 años, restauró fronteras
Ch15: Azarías (Uzías) reinó 52 años en Judá (bien, pero no quitó lugares altos), Dios lo hirió con lepra, Zacarías de Israel asesinado por Salum (reinó 6 meses), Salum asesinado por Manahem (reinó 10 años, dio tributo a Asiria), Pekaía asesinado por Peka, Tiglat-pileser deportó parte de Israel, Jotam reinó en Judá 16 años
Ch16: Acaz reinó en Judá (muy malo, quemó a su hijo, sacrificaba en lugares altos), Siria e Israel atacaron Judá, Acaz pidió ayuda a Tiglat-pileser de Asiria, le envió tesoros del templo, fue a Damasco, copió un altar pagano y lo puso en el templo, alteró las cosas del templo
Ch17: Oseas último rey de Israel (9 años), Salmanasar de Asiria lo sometió, Oseas conspiró con Egipto, Asiria sitió Samaria 3 años, cayó en 722 AC, Israel deportado a Asiria, la razón: idolatría, siguieron dioses paganos, no oyeron a los profetas, Asiria trajo extranjeros que mezclaron religiones
Ch18: Ezequías reinó en Judá (muy bueno, como David), quitó lugares altos, rompió la serpiente de bronce de Moisés (Nehustán), confió en Dios, se rebeló contra Asiria, Senaquerib invadió Judá, tomó ciudades, Rabsaces habló contra Dios en hebreo ante los muros de Jerusalén
Ch19: Ezequías se vistió de cilicio, envió a Isaías, Isaías profetizó la derrota de Senaquerib, Senaquerib envió carta blasfema, Ezequías la extendió ante Dios y oró, Dios prometió defender Jerusalén, esa noche el ángel de Jehová mató a 185,000 asirios, Senaquerib regresó a Nínive y sus hijos lo mataron
Ch20: Ezequías enfermó de muerte, Isaías dijo que moriría, Ezequías lloró y oró, Dios le añadió 15 años, señal del reloj de Acaz retrocedió 10 grados, le puso masa de higos, embajadores de Merodac-baladán de Babilonia visitaron, Ezequías les mostró todos sus tesoros, Isaías profetizó la futura cautividad babilónica
Ch21: Manasés reinó 55 años en Judá (el más malvado, reconstruyó lugares altos, puso imagen de Asera en el templo, sacrificó a su hijo, practicó adivinación, derramó mucha sangre inocente), Dios profetizó destrucción de Jerusalén, Amón reinó 2 años (malo, asesinado por siervos)
Ch22: Josías comenzó a reinar a los 8 años en Judá, a los 18 años ordenó reparar el templo, Hilcías el sacerdote encontró el Libro de la Ley, Safán lo leyó al rey, Josías rasgó sus vestiduras al oírlo, consultaron a Hulda la profetisa, ella confirmó el juicio pero dijo que Josías no lo vería por su arrepentimiento
Ch23: Josías leyó la ley ante todo el pueblo, renovó pacto con Dios, destruyó altares de Baal, quitó sacerdotes idólatras, quemó la imagen de Asera, destruyó el altar de Bet-el (cumpliendo profecía de 1 Reyes 13), derribó lugares altos de Salomón, celebró la Pascua (la mayor desde los jueces), Josías murió en batalla contra Faraón Necao en Meguido
Ch24: Joacim sirvió a Nabucodonosor 3 años y se rebeló, Joaquín reinó 3 meses, Nabucodonosor sitió Jerusalén, primera deportación (597 AC), se llevó 10,000 cautivos incluyendo al rey, dejó solo a los más pobres, puso a Sedequías (tío de Joaquín) como rey títere
Ch25: Sedequías se rebeló, Nabucodonosor sitió Jerusalén 2 años, hambruna, Sedequías huyó pero fue capturado, le sacaron los ojos, Nabuzaradán quemó el templo, el palacio y las casas (586 AC), rompió columnas de bronce, se llevó todos los utensilios, deportó al pueblo, dejó a Gedalías como gobernador, Ismael lo asesinó, pueblo huyó a Egipto, Joaquín fue liberado por Evil-merodac
`;

const parsedBooks = [];
let currentBook = null;

const lines = rawData.split('\n');
for (const line of lines) {
    if (line.trim() === '') continue;
    if (line.startsWith('**')) {
        const bookName = line.replace(/\*/g, '').replace(':', '').trim();
        currentBook = { name: bookName, chapters: [] };
        parsedBooks.push(currentBook);
    } else if (line.startsWith('Ch')) {
        const match = line.match(/^Ch(\d+):\s*(.*)$/);
        if (match && currentBook) {
            const chNum = parseInt(match[1]);
            const chSummary = match[2];
            currentBook.chapters.push({ num: chNum, summary: chSummary });
        }
    }
}

const booksMeta = [
    { name: '1 Samuel', slug: '1-samuel', chapters_count: 31, description: 'Historia de Samuel, Saúl y David...', order_index: 1 },
    { name: '2 Samuel', slug: '2-samuel', chapters_count: 24, description: 'El reinado de David...', order_index: 2 },
    { name: '1 Reyes', slug: '1-reyes', chapters_count: 22, description: 'Salomón y la división del reino...', order_index: 3 },
    { name: '2 Reyes', slug: '2-reyes', chapters_count: 25, description: 'Reyes de Israel y Judá...', order_index: 4 }
];

const achievementsData = [
    { name: 'Primeros Pasos', description: 'Completa tu primer capítulo', icon: 'Book', criteria_type: 'chapters_read', criteria_value: 1 },
    { name: 'Estudiante Dedicado', description: 'Completa 10 capítulos', icon: 'BookOpen', criteria_type: 'chapters_read', criteria_value: 10 },
    { name: 'Erudito', description: 'Completa 50 capítulos', icon: 'Library', criteria_type: 'chapters_read', criteria_value: 50 },
    { name: 'Maestro Bíblico', description: 'Completa todos los capítulos', icon: 'Award', criteria_type: 'chapters_read', criteria_value: 102 },
    { name: 'Racha de 3 Días', description: 'Estudia por 3 días consecutivos', icon: 'Flame', criteria_type: 'streak', criteria_value: 3 },
    { name: 'Racha de 7 Días', description: 'Estudia por 7 días consecutivos', icon: 'Flame', criteria_type: 'streak', criteria_value: 7 },
    { name: 'Racha de 30 Días', description: 'Estudia por 30 días consecutivos', icon: 'Flame', criteria_type: 'streak', criteria_value: 30 },
    { name: 'Cuestionador', description: 'Responde 100 preguntas', icon: 'HelpCircle', criteria_type: 'questions_answered', criteria_value: 100 },
    { name: 'Experto en Preguntas', description: 'Responde 500 preguntas', icon: 'HelpCircle', criteria_type: 'questions_answered', criteria_value: 500 },
    { name: 'Memorizador', description: 'Repasa 50 tarjetas', icon: 'Layers', criteria_type: 'flashcards_reviewed', criteria_value: 50 },
    { name: 'Cerebro Fotográfico', description: 'Repasa 200 tarjetas', icon: 'Layers', criteria_type: 'flashcards_reviewed', criteria_value: 200 },
    { name: 'Perfeccionista', description: 'Obtén 100% en un cuestionario de capítulo', icon: 'Star', criteria_type: 'perfect_quiz', criteria_value: 1 }
];

const tablesToClear = [
    'study_streaks', 'user_achievements', 'flashcard_progress', 'custom_quiz_answers',
    'custom_quiz_attempts', 'custom_quiz_configs', 'quiz_answers', 'quiz_attempts',
    'user_notes', 'flashcards', 'questions', 'chapters', 'books', 'achievements', 'users'
];

function generateQuestionsAndFlashcards(chText, chNumber, bookName) {
    const questions = [];
    const flashcards = [];
    
    // Split the summary into clauses
    const facts = chText.split(',').map(f => f.trim()).filter(f => f.length > 5);
    
    // Ensure we have enough facts, if not duplicate with slight variations
    const extendedFacts = [];
    for(let i=0; i < 15; i++) {
        extendedFacts.push(facts[i % facts.length]);
    }
    
    const distractors = [
        "David fue coronado rey", "Samuel ungió a Saúl", "El arca fue llevada a Jerusalén",
        "Salomón construyó el templo", "Elías oró por fuego del cielo",
        "Jezabel fue arrojada por la ventana", "Nabucodonosor destruyó el templo",
        "Se dividió el reino en dos", "Goliat desafió a los israelitas"
    ];

    for(let i = 0; i < 15; i++) {
        const fact = extendedFacts[i];
        
        let qType = i % 3;
        let question_text = '';
        let correct_answer = fact;
        let options = [];
        
        if (qType === 0) {
            question_text = '¿Cuál de los siguientes eventos ocurre en este capítulo?';
        } else if (qType === 1) {
            question_text = 'Completa la afirmación basada en los eventos del capítulo: ' + fact.substring(0, Math.floor(fact.length/2)) + '...';
            correct_answer = '...' + fact.substring(Math.floor(fact.length/2));
        } else {
            question_text = 'Según el relato del capítulo, es cierto que:';
        }

        options.push(correct_answer);
        // add 3 distractors
        for(let j=0; j<3; j++) {
            let dist = distractors[(i + j + chNumber) % distractors.length];
            if (dist === correct_answer) dist = "Moisés liberó a Israel";
            options.push(dist);
        }
        
        // shuffle
        options.sort(() => Math.random() - 0.5);
        
        let correctLetter = 'a';
        if (options[1] === correct_answer) correctLetter = 'b';
        if (options[2] === correct_answer) correctLetter = 'c';
        if (options[3] === correct_answer) correctLetter = 'd';
        
        questions.push({
            question_text,
            option_a: options[0],
            option_b: options[1],
            option_c: options[2],
            option_d: options[3],
            correct_answer: correctLetter,
            difficulty: i < 5 ? 'fácil' : (i < 10 ? 'medio' : 'difícil'),
            explanation: 'Basado en los eventos del capítulo: ' + fact,
            verse_reference: `${bookName} ${chNumber}`
        });
    }

    for(let i = 0; i < 5; i++) {
        const fact = facts[i % facts.length];
        flashcards.push({
            front_text: '¿Qué evento importante ocurrió que involucra lo siguiente: ' + fact.substring(0, 10) + '...?',
            back_text: fact,
            verse_reference: `${bookName} ${chNumber}`
        });
    }

    return { questions, flashcards };
}

db.transaction(() => {
    // 1. Delete from all tables
    for (const table of tablesToClear) {
        db.prepare(`DELETE FROM ${table}`).run();
    }
    
    // 2. Create admins
    const insertUser = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id');
    const hash1 = bcrypt.hashSync('alexas002', 10);
    const hash2 = bcrypt.hashSync('cristalr001', 10);
    
    const alexas = insertUser.get('alexas', 'alexas@example.com', hash1, 'admin');
    const cristalr = insertUser.get('cristalr', 'cristalr@example.com', hash2, 'admin');
    
    // 3. Create study streaks
    const insertStreak = db.prepare('INSERT INTO study_streaks (user_id, current_streak, longest_streak, last_study_date) VALUES (?, ?, ?, ?)');
    const now = new Date().toISOString();
    insertStreak.run(alexas.id, 0, 0, now);
    insertStreak.run(cristalr.id, 0, 0, now);
    
    // 4. Insert Books & Chapters
    const insertBook = db.prepare('INSERT INTO books (name, slug, chapters_count, description, order_index) VALUES (?, ?, ?, ?, ?) RETURNING id');
    const insertChapter = db.prepare('INSERT INTO chapters (book_id, chapter_number, title, summary) VALUES (?, ?, ?, ?) RETURNING id');
    const insertQuestion = db.prepare('INSERT INTO questions (chapter_id, question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty, explanation, verse_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertFlashcard = db.prepare('INSERT INTO flashcards (chapter_id, front_text, back_text, verse_reference, created_by) VALUES (?, ?, ?, ?, ?)');
    const insertAchievement = db.prepare('INSERT INTO achievements (name, description, icon, criteria_type, criteria_value) VALUES (?, ?, ?, ?, ?)');
    
    for (const b of booksMeta) {
        const bookObj = insertBook.get(b.name, b.slug, b.chapters_count, b.description, b.order_index);
        const bookData = parsedBooks.find(pb => pb.name.toUpperCase() === b.name.toUpperCase());
        
        console.log(`Seeding ${b.name}...`);
        
        if (bookData) {
            for (const ch of bookData.chapters) {
                const chapterObj = insertChapter.get(bookObj.id, ch.num, `Capítulo ${ch.num}`, ch.summary);
                
                const { questions, flashcards } = generateQuestionsAndFlashcards(ch.summary, ch.num, b.name);
                
                for (const q of questions) {
                    insertQuestion.run(chapterObj.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.difficulty, q.explanation, q.verse_reference);
                }
                
                for (const f of flashcards) {
                    insertFlashcard.run(chapterObj.id, f.front_text, f.back_text, f.verse_reference, alexas.id);
                }
            }
        }
    }
    
    // 8. Insert Achievements
    for (const a of achievementsData) {
        insertAchievement.run(a.name, a.description, a.icon, a.criteria_type, a.criteria_value);
    }
    
    console.log("Database seeded successfully!");
})();
