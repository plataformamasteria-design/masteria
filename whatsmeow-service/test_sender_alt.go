package main

import (
	"fmt"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

func main() {
	var evt events.Message
	evt.Info = types.MessageInfo{}
	
	// Test if SenderAlt is on MessageInfo or MessageSource
	// Wait, types.MessageInfo embeds types.MessageSource.
	fmt.Printf("%v\n", evt.Info.SenderAlt.User)
}
