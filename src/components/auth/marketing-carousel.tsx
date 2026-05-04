'use client';

import { useRef } from 'react';
import { BotMessageSquare, Quote } from 'lucide-react';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
} from '@/components/ui/carousel';
import Autoplay from "embla-carousel-autoplay";

const marketingQuotes = [
    {
        quote: "O objetivo do marketing é conhecer e entender o cliente tão bem que o produto ou serviço se vende sozinho.",
        author: "Peter Drucker"
    },
    {
        quote: "Marketing não é sobre as coisas que você faz, mas sobre as histórias que você conta.",
        author: "Seth Godin"
    },
    {
        quote: "As pessoas não compram o que você faz, elas compram o porquê você faz.",
        author: "Simon Sinek"
    },
    {
        quote: "A melhor publicidade é a que os clientes satisfeitos fazem.",
        author: "Philip Kotler"
    },
    {
        quote: "O ótimo marketing faz o cliente se sentir inteligente.",
        author: "Joe Chernov"
    }
];

export function MarketingCarousel() {
    const plugin = useRef(
        Autoplay({ delay: 7000, stopOnInteraction: false, stopOnMouseEnter: true })
    );

    return (
        <div className="hidden lg:flex flex-col items-center justify-center bg-muted/40 p-10 text-center space-y-6">
            <div className="flex items-center gap-4 text-primary">
                <BotMessageSquare className="h-12 w-12" />
                <h1 className="text-4xl font-bold text-foreground">Master IA</h1>
            </div>
            <Carousel
                opts={{
                    loop: true,
                    align: "start",
                }}
                plugins={[plugin.current]}
                className="w-full max-w-lg"
            >
                <CarouselContent>
                    {marketingQuotes.map((item, index) => (
                        <CarouselItem key={index}>
                            <div className="p-1 text-center">
                                <Quote className="h-8 w-8 text-muted-foreground mb-4 mx-auto" />
                                <p className="text-xl font-medium text-foreground">&quot;{item.quote}&quot;</p>
                                <p className="text-sm text-muted-foreground mt-4">- {item.author}</p>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>
        </div>
    );
}
