const dropZone=document.querySelector(".drop-zone")
const browsebtn=document.querySelector(".browsebtn")
const fileinput=document.querySelector("#fileinput")

dropZone.addEventListener("dragover",(e)=>{
    //console.log("dragging");
    e.preventDefault();
    if(!dropZone.classList.contains("dragged")){
        dropZone.classList.add("dragged");
    }
})
dropZone.addEventListener("dragleave",()=>{
    dropZone.classList.remove("dragged");
})
dropZone.addEventListener("drop",(e)=>{
    e.preventDefault();
    dropZone.classList.remove("dragged");
    const files=e.dataTransfer.files;
    console.log(files);
    if(files.length){
        fileinput.files=files;
    }
})
browsebtn.addEventListener("click",()=>{
    fileinput.click();
})