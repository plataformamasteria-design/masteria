async function run() {
  const url = "https://scontent.whatsapp.net/v/t61.29466-34/593961062_1655668925686378_3745880973619375483_n.jpg?ccb=1-7&_nc_sid=8b1bef&_nc_ohc=CoyzyVXpucAQ7kNvwHiu9D-&_nc_oc=AdpMwif7YzL9-NFiho0Cr8GkDH8d5BBizi9Zco2sCFCtfU509Nw02vsQjyb3P5rYOdjm8vgPhxFOPKpPFx2cwsHw&_nc_zt=3&_nc_ht=scontent.whatsapp.net&edm=AH51TzQEAAAA&_nc_gid=DPawGxDPogdwyUtYSuSuQA&_nc_tpa=Q5bMBQHQz5xu_iW4GkmVx-UNV0mxJqv_Zk21gEDL-gqSzdSR9C2PIy54-j_6_zAnslUH-nj-zDMijdO4fA&oh=01_Q5Aa4QEsINKEmhlhKgytT2MqXirtG4P_9oP7ktKR-jX4kvdqDQ&oe=6A21B9CF";
  
  const res = await fetch(url);
  console.log("Status:", res.status);
  process.exit(0);
}
run();
