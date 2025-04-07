$(document).ready(function(){

    // Scroll Elementos Menu
        var acercaDe = $('#acerca-de').offset().top,
            planes = $('#planes').offset().top,
            galeria = $('#galeria').offset().top,
            contacto = $('#contacto').offset().top;
    
    // Boton Acerca de
        $('#btn-acerca-de').on('click', function(e){
            e.preventDefault();
            $('html, body').animate({
                scrollTop: 380
            }, 500);
        });
    
        $('#btn-planes').on('click', function(e){
            e.preventDefault();
            $('html, body').animate({
                scrollTop: planes - 40
            });
        });
    
        $('#btn-galeria').on('click', function(e){
            e.preventDefault();
            $('html, body').animate({
                scrollTop: galeria - 40
            });
        });
    
        $('#btn-contacto').on('click', function(e){
            e.preventDefault();
            $('html, body').animate({
                scrollTop: contacto - 40
            });
        });
    
    // Efecto Menu
        $('.planes a').each(function(index, elemento){
            $(this).css({
                'top': '-200px'
            });
    
            $(this).animate({
                top: '0'
            },2000 + (index * 500));
        });
    
    
    // Efecto Header
        if ($(window).width() > 800){
            $('header .textos').css({
                opacity: 0,
                marginTop: 0
            });
    
            $('header .textos').animate({
                opacity: 1,
                marginTop: '-52px'
            },1500);
        }
    
    });